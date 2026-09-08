import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { Workspace } from "../../domain/entities/Workspace.js";
import { DateRange } from "../../domain/value-objects/DateRange.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import { Money } from "../../domain/value-objects/Money.js";
import { Rounding } from "../../domain/value-objects/Rounding.js";
import type { ProjectHours, ReportData, ReportService } from "./ReportService.js";
import {
  describeDateRangeShortcut,
  resolveDateRangeShortcut,
  trailingMonths,
  type DateRangeShortcut,
} from "./DateRangeShortcuts.js";

/** Totals for one named window of time — a row in `tck earnings`' summary. */
export interface PeriodEarnings {
  label: string;
  hours: number;
  billableHours: number;
  amount: Money;
  /** Billable hours with no resolvable rate, so excluded from `amount`. */
  unbilledHours: number;
}

/** One bar in an earnings chart: a day or a month. */
export interface EarningsBucket {
  /** Sort/lookup key — `2026-09-07` for days, `2026-09` for months. */
  key: string;
  hours: number;
  amount: Money;
}

/** `tck earnings` with no range: how much is coming in, at a glance. */
export interface EarningsSummary {
  workspace: Workspace;
  periods: PeriodEarnings[];
  /** Revenue per calendar month, oldest first, gaps filled with zeros. */
  monthlyTrend: EarningsBucket[];
}

/** Whether a trend's bars cover one day or one calendar month each. */
export type TrendGranularity = "day" | "month";

/** `tck earnings --this-month`: one period in depth, against the previous one. */
export interface EarningsDetail {
  workspace: Workspace;
  current: PeriodEarnings;
  /** The comparable previous period, or `null` when the range has no counterpart. */
  previous: PeriodEarnings | null;
  /** Revenue over the range, gaps filled with zeros, one bar per `granularity`. */
  trend: EarningsBucket[];
  granularity: TrendGranularity;
  byProject: ProjectHours[];
}

export interface EarningsOptions {
  rounding?: Rounding;
}

/** The periods the no-flag summary answers for, in display order. */
const SUMMARY_SHORTCUTS: DateRangeShortcut[] = ["today", "this-week", "this-month", "this-year"];
const TREND_MONTHS = 6;
/** Past this many days a detail view plots months instead of days. */
const MAX_DAILY_TREND_DAYS = 62;

/**
 * Answers "how much am I earning?" (`tck earnings`, see README's Earnings
 * section). Composes `ReportService` rather than querying entries itself —
 * earnings are just a report's billable amounts sliced by period, so the
 * pricing rules (frozen per-entry rates, rounding) can never diverge.
 */
export class EarningsService {
  constructor(private readonly reports: ReportService) {}

  /** Totals for today / this week / this month / this year, plus a monthly trend. */
  async summarize(
    workspace: Workspace,
    baseFilter: TimeEntryFilter,
    weekStart: WeekStart,
    options: EarningsOptions = {},
  ): Promise<EarningsSummary> {
    const rounding = options.rounding ?? Rounding.none();
    const periods = await Promise.all(
      SUMMARY_SHORTCUTS.map(async (shortcut) => {
        const range = resolveDateRangeShortcut(shortcut, weekStart);
        const report = await this.reports.build(
          workspace,
          { ...baseFilter, range },
          { rounding, showRounding: false },
        );
        return EarningsService.toPeriod(describeDateRangeShortcut(shortcut), report);
      }),
    );

    return { workspace, periods, monthlyTrend: await this.monthlyTrend(workspace, baseFilter, rounding) };
  }

  /** One range in depth, compared against `previousRange` when one is given. */
  async detail(
    workspace: Workspace,
    filter: TimeEntryFilter,
    label: string,
    previousRange: DateRange | null,
    options: EarningsOptions = {},
  ): Promise<EarningsDetail> {
    const rounding = options.rounding ?? Rounding.none();
    const report = await this.reports.build(workspace, filter, { rounding, showRounding: false });

    let previous: PeriodEarnings | null = null;
    if (previousRange) {
      const previousReport = await this.reports.build(
        workspace,
        { ...filter, range: previousRange },
        { rounding, showRounding: false },
      );
      previous = EarningsService.toPeriod("Previous", previousReport);
    }

    // A year of daily bars is unreadable, so long ranges switch to one bar
    // per month — same data, a granularity that fits on screen.
    const granularity: TrendGranularity =
      filter.range && filter.range.durationMs() > MAX_DAILY_TREND_DAYS * 86_400_000
        ? "month"
        : "day";
    const trend =
      granularity === "month"
        ? EarningsService.bucketBy(
            report,
            workspace,
            monthKey,
            filter.range ? monthKeysIn(filter.range) : [],
          )
        : // Seeded with the report's own day series, so the daily chart
          // inherits its gap-filling.
          EarningsService.bucketBy(
            report,
            workspace,
            localIsoDate,
            report.hoursByDay.map((day) => day.date),
          );

    return {
      workspace,
      current: EarningsService.toPeriod(label, report),
      previous,
      trend,
      granularity,
      byProject: report.hoursByProject,
    };
  }

  private async monthlyTrend(
    workspace: Workspace,
    baseFilter: TimeEntryFilter,
    rounding: Rounding,
  ): Promise<EarningsBucket[]> {
    const months = trailingMonths(TREND_MONTHS);
    const first = months[0];
    const last = months[months.length - 1];
    if (!first || !last) return [];

    // One query for the whole span, then bucketed in memory — six separate
    // reports would re-read every project and tag six times over.
    const report = await this.reports.build(
      workspace,
      { ...baseFilter, range: DateRange.of(first.start, last.end) },
      { rounding, showRounding: false },
    );
    const keys = months.map((month) => monthKey(month.start));
    return EarningsService.bucketBy(report, workspace, monthKey, keys);
  }

  private static toPeriod(label: string, report: ReportData): PeriodEarnings {
    return {
      label,
      hours: report.totalHours,
      billableHours: report.billableHours,
      amount: report.billableAmount,
      unbilledHours: report.hoursByProject.reduce((sum, p) => sum + p.unbilledHours, 0),
    };
  }

  /**
   * Groups a report's entries into buckets keyed by `keyOf`, seeded with
   * `keys` so periods without income still render a (zero) bar.
   */
  private static bucketBy(
    report: ReportData,
    workspace: Workspace,
    keyOf: (date: Date) => string,
    keys: readonly string[],
  ): EarningsBucket[] {
    const buckets = new Map<string, EarningsBucket>(
      keys.map((key) => [key, { key, hours: 0, amount: Money.zero(workspace.currency) }]),
    );
    for (const entry of report.entries) {
      const key = keyOf(entry.startTs);
      const bucket = buckets.get(key) ?? { key, hours: 0, amount: Money.zero(workspace.currency) };
      bucket.hours += report.hoursByEntryId.get(entry.id) ?? 0;
      const amount = report.amountByEntryId.get(entry.id);
      if (amount) bucket.amount = bucket.amount.add(amount);
      buckets.set(key, bucket);
    }
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }
}

/** `YYYY-MM-DD` in local time, matching how `ReportService` keys its days. */
function localIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `YYYY-MM` in local time — the key one bar of the monthly trend covers. */
function monthKey(date: Date): string {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

/** Every month key a range touches, oldest first, so quiet months still get a bar. */
function monthKeysIn(range: DateRange): string[] {
  const keys: string[] = [];
  // The range end is exclusive, so a range ending exactly at a month
  // boundary must not add that next month.
  const last = new Date(range.end.getTime() - 1);
  const cursor = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  while (cursor <= last) {
    keys.push(monthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}
