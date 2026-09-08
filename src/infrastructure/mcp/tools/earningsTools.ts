import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import type { TimeEntryFilter } from "../../../domain/repositories/TimeEntryRepository.js";
import type {
  EarningsBucket,
  PeriodEarnings,
} from "../../../application/services/EarningsService.js";
import {
  describeDateRangeShortcut,
  precedingRange,
  previousDateRangeShortcut,
  resolveDateRangeShortcut,
} from "../../../application/services/DateRangeShortcuts.js";
import { Rounding, ROUNDING_MODES, type RoundingMode } from "../../../domain/value-objects/Rounding.js";
import { resolveProjectId, resolveProjectIdsByClient } from "../../../cli/commands/lookups.js";
import { dateRangeShape, jsonResult, resolveRangeInput, safeHandler, serializeMoney } from "../shared.js";

const earningsShape = {
  workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
  ...dateRangeShape,
  project: z.string().optional().describe("Only count this project's entries"),
  client: z
    .string()
    .optional()
    .describe("Only count this client's projects — covers every project they own"),
  rounding: z.enum(ROUNDING_MODES as [RoundingMode, ...RoundingMode[]]).optional(),
  roundingMinutes: z.number().int().positive().optional(),
};

type EarningsInput = {
  workspace?: string | undefined;
  project?: string | undefined;
  client?: string | undefined;
  rounding?: RoundingMode | undefined;
  roundingMinutes?: number | undefined;
  range?: Parameters<typeof resolveRangeInput>[0]["range"];
  from?: string | undefined;
  to?: string | undefined;
};

function serializePeriod(period: PeriodEarnings): Record<string, unknown> {
  return {
    label: period.label,
    earned: serializeMoney(period.amount),
    hours: Number(period.hours.toFixed(2)),
    billableHours: Number(period.billableHours.toFixed(2)),
    unbilledHours: Number(period.unbilledHours.toFixed(2)),
  };
}

function serializeBucket(bucket: EarningsBucket): Record<string, unknown> {
  return {
    key: bucket.key,
    earned: serializeMoney(bucket.amount),
    hours: Number(bucket.hours.toFixed(2)),
  };
}

/** Income tools mirroring `tck earnings` — the money view over tracked time. */
export function registerEarningsTools(server: McpServer, container: Container): void {
  /** Shared resolution of workspace, scope filters and rounding. */
  async function resolveScope(input: EarningsInput) {
    const workspace = await container.workspaceService.resolveActive(input.workspace);
    const config = container.configStore.read();

    const filter: TimeEntryFilter = { workspaceId: workspace.id };
    if (input.project) {
      filter.projectId = await resolveProjectId(container, workspace.id, input.project);
    }
    if (input.client) {
      filter.projectIds = await resolveProjectIdsByClient(container, workspace.id, input.client);
    }

    const rounding = Rounding.of(
      input.rounding ?? config.rounding.mode,
      input.roundingMinutes ?? config.rounding.minutes,
    );
    return { workspace, config, filter, rounding };
  }

  server.registerTool(
    "get_earnings_summary",
    {
      title: "Get earnings summary",
      description:
        "How much was earned today, this week, this month and this year, plus a six-month monthly trend",
      inputSchema: earningsShape,
    },
    safeHandler(async (input: EarningsInput) => {
      const { workspace, config, filter, rounding } = await resolveScope(input);
      const summary = await container.earningsService.summarize(
        workspace,
        filter,
        config.weekStart,
        { rounding },
      );
      return jsonResult({
        workspace: workspace.slug,
        currency: workspace.currency,
        periods: summary.periods.map(serializePeriod),
        monthlyTrend: summary.monthlyTrend.map(serializeBucket),
      });
    }),
  );

  server.registerTool(
    "get_earnings_for_range",
    {
      title: "Get earnings for a range",
      description:
        "Earnings over one date range, compared against the previous equivalent period, with a per-day (or per-month, for long ranges) trend and a per-project breakdown",
      inputSchema: earningsShape,
    },
    safeHandler(async (input: EarningsInput) => {
      const { workspace, config, filter, rounding } = await resolveScope(input);
      const { range } = resolveRangeInput(input, config.weekStart);
      const label = input.range ? describeDateRangeShortcut(input.range) : undefined;
      if (!range) {
        // Without a range this would silently report all-time totals, which
        // is `get_earnings_summary`'s job — say so instead of guessing.
        return jsonResult({
          error: "Provide `range` (a calendar shortcut) or both `from` and `to`.",
        });
      }

      // Calendar shortcuts compare against their natural counterpart;
      // rolling and custom ranges against the window right before them.
      const counterpart = input.range ? previousDateRangeShortcut(input.range) : undefined;
      const previous = counterpart
        ? resolveDateRangeShortcut(counterpart, config.weekStart)
        : precedingRange(range);

      const detail = await container.earningsService.detail(
        workspace,
        { ...filter, range },
        label ?? "Custom range",
        previous,
        { rounding },
      );

      return jsonResult({
        workspace: workspace.slug,
        currency: workspace.currency,
        current: serializePeriod(detail.current),
        previous: detail.previous ? serializePeriod(detail.previous) : null,
        granularity: detail.granularity,
        trend: detail.trend.map(serializeBucket),
        byProject: detail.byProject.map((project) => ({
          project: project.projectName,
          earned: serializeMoney(project.amount),
          hours: Number(project.hours.toFixed(2)),
          billableHours: Number(project.billableHours.toFixed(2)),
        })),
      });
    }),
  );
}
