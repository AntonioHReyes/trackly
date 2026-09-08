import type { Command } from "commander";
import type { Container } from "../container.js";
import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { DateRange } from "../../domain/value-objects/DateRange.js";
import type { Money } from "../../domain/value-objects/Money.js";
import type {
  EarningsDetail,
  EarningsSummary,
  PeriodEarnings,
} from "../../application/services/EarningsService.js";
import {
  precedingRange,
  previousDateRangeShortcut,
  resolveDateRangeShortcut,
  type DateRangeShortcut,
} from "../../application/services/DateRangeShortcuts.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import * as ui from "../ui/index.js";
import { addDateRangeOptions, resolveDateRangeSelection } from "./dateRangeOptions.js";
import type { DateRangeCliOptions } from "./dateRangeOptions.js";
import { addRoundingOptions, resolveRounding } from "./roundingOptions.js";
import type { RoundingCliOptions } from "./roundingOptions.js";
import { resolveProjectId, resolveProjectIdsByClient } from "./lookups.js";

interface WorkspaceOpts {
  workspace?: string;
}

type EarningsOptions = DateRangeCliOptions &
  RoundingCliOptions & {
    project?: string;
    client?: string;
  };

/** `tck earnings` — how much the tracked time is worth (see README's Earnings section). */
export function registerEarningsCommands(program: Command, container: Container): void {
  addRoundingOptions(addDateRangeOptions(program.command("earnings")))
    .description("Show income for today, this week, this month and this year (or a given range)")
    .option("--project <name>", "only count this project's entries")
    .option("--client <name>", "only count this client's projects")
    .action(async (options: EarningsOptions) => {
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      const config = container.configStore.read();
      const rounding = resolveRounding(options, config);

      const filter: TimeEntryFilter = { workspaceId: workspace.id };
      if (options.project) {
        filter.projectId = await resolveProjectId(container, workspace.id, options.project);
      }
      if (options.client) {
        filter.projectIds = await resolveProjectIdsByClient(container, workspace.id, options.client);
      }

      const scope = [options.client, options.project].filter(Boolean).join(" · ");
      const { range, label, shortcut } = resolveDateRangeSelection(options, config.weekStart);

      if (!range) {
        const summary = await container.earningsService.summarize(
          workspace,
          filter,
          config.weekStart,
          { rounding },
        );
        renderSummary(summary, scope);
        return;
      }

      const detail = await container.earningsService.detail(
        workspace,
        { ...filter, range },
        label ?? describeRange(range),
        previousRangeFor(range, shortcut, config.weekStart),
        { rounding },
      );
      renderDetail(detail, scope);
    });
}

/**
 * What a period is compared against: a calendar shortcut uses its natural
 * counterpart ("this month" vs "last month"), everything else the window of
 * equal length immediately before it.
 */
function previousRangeFor(
  range: DateRange,
  shortcut: DateRangeShortcut | undefined,
  weekStart: WeekStart,
): DateRange {
  const counterpart = shortcut ? previousDateRangeShortcut(shortcut) : undefined;
  return counterpart ? resolveDateRangeShortcut(counterpart, weekStart) : precedingRange(range);
}

function renderSummary(summary: EarningsSummary, scope: string): void {
  const { workspace } = summary;
  ui.blank();
  ui.heading("Earnings", [workspace.slug, scope].filter(Boolean).join(" · "));
  ui.blank();

  ui.print(
    ui.renderTable(
      ["Period", { header: "Earned", align: "right" }, { header: "Hours", align: "right" }, "Billable"],
      summary.periods.map((period) => [
        period.label,
        moneyCell(period.amount),
        `${period.hours.toFixed(2)}h`,
        billableCell(period),
      ]),
    ),
  );

  ui.blank();
  ui.print(ui.chartHeading(`Monthly trend (last ${summary.monthlyTrend.length} months)`));
  ui.print(ui.renderEarningsChart(summary.monthlyTrend));
  ui.blank();
  warnUnbilled(summary.periods);
  ui.hint("tck earnings --this-month  ·  tck earnings --client <name>");
}

function renderDetail(detail: EarningsDetail, scope: string): void {
  const { workspace, current, previous } = detail;
  ui.blank();
  ui.heading(
    `Earnings · ${current.label}`,
    [workspace.slug, scope].filter(Boolean).join(" · "),
  );
  ui.print(
    `  ${ui.em(moneyCell(current.amount))}   ${ui.dim(
      `${current.billableHours.toFixed(2)}h billable of ${current.hours.toFixed(2)}h tracked`,
    )}`,
  );
  if (previous) {
    ui.print(`  ${comparisonLine(current.amount, previous.amount)}`);
  }
  ui.blank();

  ui.print(ui.chartHeading(detail.granularity === "month" ? "Earned by month" : "Earned by day"));
  ui.print(ui.renderEarningsChart(detail.trend));
  ui.blank();

  if (detail.byProject.length > 0) {
    ui.print(ui.chartHeading("By project"));
    ui.print(
      ui.renderTable(
        ["Project", { header: "Earned", align: "right" }, { header: "Hours", align: "right" }],
        detail.byProject.map((project) => [
          project.projectName,
          moneyCell(project.amount),
          `${project.hours.toFixed(2)}h`,
        ]),
      ),
    );
    ui.blank();
  }
  warnUnbilled([current]);
}

/** `+18% vs previous period (1,200.00 MXN)` — the "am I doing better?" line. */
function comparisonLine(current: Money, previous: Money): string {
  const currentValue = current.toDecimal();
  const previousValue = previous.toDecimal();
  const suffix = ui.dim(`vs previous period (${moneyCell(previous)})`);

  if (previousValue === 0) {
    return currentValue === 0 ? ui.dim(`— ${suffix}`) : `${ui.green("new income")} ${suffix}`;
  }
  const change = ((currentValue - previousValue) / previousValue) * 100;
  const arrow = change >= 0 ? "▲" : "▼";
  const tone = change >= 0 ? ui.green : ui.yellow;
  return `${tone(`${arrow} ${change >= 0 ? "+" : ""}${change.toFixed(0)}%`)} ${suffix}`;
}

function moneyCell(amount: Money): string {
  return ui.formatMoney(amount.toDecimal(), amount.currency);
}

function billableCell(period: PeriodEarnings): string {
  if (period.hours === 0) return ui.dim("—");
  return ui.dim(`${((period.billableHours / period.hours) * 100).toFixed(0)}%`);
}

/** Billable time with no rate is silently worth zero — say so instead of hiding it. */
function warnUnbilled(periods: readonly PeriodEarnings[]): void {
  const unbilled = Math.max(...periods.map((period) => period.unbilledHours));
  if (unbilled > 0) {
    ui.hint(
      `${unbilled.toFixed(2)}h billable have no rate and aren't counted — set one with tck rate set`,
    );
  }
}

/** Fallback label for a custom `--from/--to` range. */
function describeRange(range: DateRange): string {
  const to = new Date(range.end.getTime() - 1);
  return `${range.start.toLocaleDateString()} → ${to.toLocaleDateString()}`;
}
