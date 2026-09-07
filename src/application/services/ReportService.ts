import type {
  TimeEntryRepository,
  TimeEntryFilter,
} from "../../domain/repositories/TimeEntryRepository.js";
import type { ProjectRepository } from "../../domain/repositories/ProjectRepository.js";
import type { TagRepository } from "../../domain/repositories/TagRepository.js";
import type { Workspace } from "../../domain/entities/Workspace.js";
import type { Project } from "../../domain/entities/Project.js";
import type { TimeEntry } from "../../domain/entities/TimeEntry.js";
import { Money } from "../../domain/value-objects/Money.js";
import { Rounding } from "../../domain/value-objects/Rounding.js";

export interface DayHours {
  /** Local calendar day as `YYYY-MM-DD`, matching how date ranges are resolved. */
  date: string;
  hours: number;
}

export interface ProjectHours {
  projectId: string | null;
  projectName: string;
  hours: number;
  billableHours: number;
  amount: Money;
  /** The rate this project's billable amount was computed at, or `null` if none resolves. */
  rate: Money | null;
  /**
   * Billable hours within this project that had no resolvable rate (so
   * they're excluded from `amount`) — entries can differ here from their
   * project's *current* rate, since each carries the rate it was billed at.
   */
  unbilledHours: number;
}

/** Knobs that change how raw entries are aggregated, without changing what is stored. */
export interface ReportOptions {
  rounding?: Rounding;
  /** Shortcut name (`Last month`, ...) shown in the report header. */
  rangeLabel?: string;
  /**
   * Whether the rendered report mentions the rounding it applied. Defaults to
   * `true`; `report pdf --hide-rounding` turns it off for documents that go
   * out to a client. It only affects the wording — the durations are rounded
   * either way.
   */
  showRounding?: boolean;
}

/**
 * Aggregated view of a workspace's time entries over a filter, shared by
 * both the PDF report and the CSV export (see SPEC.md's Reports/Export
 * commands) — one computation, two renderings.
 */
export interface ReportData {
  workspace: Workspace;
  /** Human-readable summary of the filter used to build this report, for headers. */
  filterLabel: string;
  /** The rounding applied to every duration below (`Rounding.none()` when off). */
  rounding: Rounding;
  /** Whether exporters should spell the rounding out in the rendered document. */
  showRounding: boolean;
  entries: TimeEntry[];
  /** Lookups so exporters can render names/amounts without a second round-trip. */
  projectNameById: Map<string, string>;
  tagNameById: Map<string, string>;
  /** Per-entry duration after rounding — what every total here is built from. */
  hoursByEntryId: Map<string, number>;
  /** Billable amount per entry (only present for billable entries with a resolvable rate). */
  amountByEntryId: Map<string, Money>;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  billableAmount: Money;
  hoursByDay: DayHours[];
  hoursByProject: ProjectHours[];
}

const NO_PROJECT_LABEL = "(no project)";
/** Beyond ~two months, one bar per day stops being readable. */
const MAX_FILLED_DAYS = 62;

export class ReportService {
  constructor(
    private readonly entries: TimeEntryRepository,
    private readonly projects: ProjectRepository,
    private readonly tags: TagRepository,
  ) {}

  async build(
    workspace: Workspace,
    filter: TimeEntryFilter,
    options: ReportOptions = {},
  ): Promise<ReportData> {
    const rounding = options.rounding ?? Rounding.none();
    const showRounding = options.showRounding ?? true;
    const list = await this.entries.findByFilter(filter);
    const projectsById = new Map(
      (await this.projects.findByWorkspace(workspace.id, { includeArchived: true })).map((p) => [
        p.id,
        p,
      ]),
    );
    const tagNameById = new Map(
      (await this.tags.findByWorkspace(workspace.id)).map((t) => [t.id, t.name]),
    );

    let billableHours = 0;
    let nonBillableHours = 0;
    let billableAmount = Money.zero(workspace.currency);
    const byDay = new Map<string, number>();
    const byProject = new Map<string, ProjectBucket>();
    const hoursByEntryId = new Map<string, number>();
    const amountByEntryId = new Map<string, Money>();

    for (const entry of list) {
      const hours = rounding.applyHours(entry.durationHours());
      hoursByEntryId.set(entry.id, hours);
      if (entry.billable) {
        billableHours += hours;
      } else {
        nonBillableHours += hours;
      }

      const day = localIsoDate(entry.startTs);
      byDay.set(day, (byDay.get(day) ?? 0) + hours);

      const project = entry.projectId ? projectsById.get(entry.projectId) : undefined;
      const key = project?.id ?? "";
      const bucket = byProject.get(key) ?? {
        name: project?.name ?? NO_PROJECT_LABEL,
        hours: 0,
        billableHours: 0,
        amount: Money.zero(workspace.currency),
        rate: null,
        unbilledHours: 0,
      };
      bucket.hours += hours;
      byProject.set(key, bucket);

      if (entry.billable) {
        bucket.billableHours += hours;
        const rate = ReportService.resolveEntryRate(entry, project, workspace);
        if (rate) {
          bucket.rate = rate;
          const amount = rate.multiply(hours);
          billableAmount = billableAmount.add(amount);
          bucket.amount = bucket.amount.add(amount);
          amountByEntryId.set(entry.id, amount);
        } else {
          bucket.unbilledHours += hours;
        }
      }
    }

    return {
      workspace,
      filterLabel: ReportService.describeFilter(
        filter,
        showRounding ? rounding : Rounding.none(),
        options.rangeLabel,
      ),
      rounding,
      showRounding,
      entries: list,
      projectNameById: new Map([...projectsById.entries()].map(([id, p]) => [id, p.name])),
      tagNameById,
      hoursByEntryId,
      amountByEntryId,
      totalHours: billableHours + nonBillableHours,
      billableHours,
      nonBillableHours,
      billableAmount,
      hoursByDay: ReportService.toDailySeries(byDay, filter),
      hoursByProject: [...byProject.entries()]
        .map(([projectId, v]) => ({
          projectId: projectId === "" ? null : projectId,
          projectName: v.name,
          hours: v.hours,
          billableHours: v.billableHours,
          amount: v.amount,
          rate: v.rate,
          unbilledHours: v.unbilledHours,
        }))
        .sort((a, b) => b.hours - a.hours),
    };
  }

  /**
   * The rate an entry's amount is priced at: its own frozen snapshot if it
   * has one, otherwise today's project/workspace rate. The fallback only
   * matters for entries that predate rate-snapshotting (see migration 2) —
   * every entry created since always carries its own rate.
   */
  private static resolveEntryRate(
    entry: TimeEntry,
    project: Project | undefined,
    workspace: Workspace,
  ): Money | null {
    if (entry.rate !== null) {
      return Money.fromDecimal(entry.rate, workspace.currency);
    }
    return project ? project.resolveRate(workspace) : workspace.resolveDefaultRate();
  }

  /**
   * Days with no entries are filled with zeros when the report is bounded by
   * a range, so charts show a continuous timeline (a gap-free week reads very
   * differently from one with a blank Wednesday). Unbounded or very long
   * ranges keep only the days that have data, to avoid thousands of columns.
   */
  private static toDailySeries(byDay: Map<string, number>, filter: TimeEntryFilter): DayHours[] {
    const recorded = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, hours]) => ({ date, hours }));
    const range = filter.range;
    if (!range) return recorded;

    const days = Math.ceil(range.durationMs() / 86_400_000);
    if (days < 1 || days > MAX_FILLED_DAYS) return recorded;

    const series: DayHours[] = [];
    const cursor = new Date(
      range.start.getFullYear(),
      range.start.getMonth(),
      range.start.getDate(),
    );
    while (cursor.getTime() < range.end.getTime()) {
      const key = localIsoDate(cursor);
      series.push({ date: key, hours: byDay.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    return series;
  }

  private static describeFilter(
    filter: TimeEntryFilter,
    rounding: Rounding,
    rangeLabel: string | undefined,
  ): string {
    const parts: string[] = [];
    if (filter.range) {
      // The range end is exclusive, so the last covered day is one ms earlier.
      const from = localIsoDate(filter.range.start);
      const to = localIsoDate(new Date(filter.range.end.getTime() - 1));
      const dates = from === to ? from : `${from} to ${to}`;
      parts.push(rangeLabel ? `${rangeLabel} (${dates})` : dates);
    } else {
      parts.push("All time");
    }
    if (filter.billable !== undefined) {
      parts.push(filter.billable ? "billable only" : "non-billable only");
    }
    if (rounding.isEnabled) {
      parts.push(`rounded ${rounding.describe()}`);
    }
    return parts.join(" · ");
  }
}

interface ProjectBucket {
  name: string;
  hours: number;
  billableHours: number;
  amount: Money;
  rate: Money | null;
  unbilledHours: number;
}

/** `YYYY-MM-DD` in local time — `toISOString()` would shift the day by the UTC offset. */
function localIsoDate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
