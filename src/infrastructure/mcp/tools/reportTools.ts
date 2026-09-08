import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import type { TimeEntryFilter } from "../../../domain/repositories/TimeEntryRepository.js";
import type { ReportData } from "../../../application/services/ReportService.js";
import { Rounding, ROUNDING_MODES, type RoundingMode } from "../../../domain/value-objects/Rounding.js";
import {
  resolveProjectId,
  resolveProjectIdsByClient,
  resolveTagIds,
} from "../../../cli/commands/lookups.js";
import { dateRangeShape, jsonResult, resolveRangeInput, safeHandler, serializeMoney } from "../shared.js";

const reportFilterShape = {
  workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
  ...dateRangeShape,
  project: z.string().optional().describe("Filter by project name"),
  client: z
    .string()
    .optional()
    .describe("Filter by client name — covers every project belonging to that client"),
  tag: z.string().optional().describe("Filter by tag name"),
  billable: z.boolean().optional().describe("Filter to billable (true) or non-billable (false) only"),
  rounding: z.enum(ROUNDING_MODES as [RoundingMode, ...RoundingMode[]]).optional(),
  roundingMinutes: z.number().int().positive().optional(),
};

/** Resolves the shared report filter shape into `ReportData`, reusing `ReportService.build`. */
async function buildReportData(
  container: Container,
  input: {
    workspace?: string | undefined;
    project?: string | undefined;
    client?: string | undefined;
    tag?: string | undefined;
    billable?: boolean | undefined;
    rounding?: RoundingMode | undefined;
    roundingMinutes?: number | undefined;
    range?: Parameters<typeof resolveRangeInput>[0]["range"];
    from?: string | undefined;
    to?: string | undefined;
  },
): Promise<ReportData> {
  const workspace = await container.workspaceService.resolveActive(input.workspace);
  const config = container.configStore.read();
  const { range, label } = resolveRangeInput(input, config.weekStart);

  const filter: TimeEntryFilter = { workspaceId: workspace.id };
  if (range) filter.range = range;
  if (input.project) filter.projectId = await resolveProjectId(container, workspace.id, input.project);
  if (input.client) {
    filter.projectIds = await resolveProjectIdsByClient(container, workspace.id, input.client);
  }
  if (input.tag) {
    const tagId = (await resolveTagIds(container, workspace.id, input.tag))[0];
    if (tagId) filter.tagId = tagId;
  }
  if (input.billable !== undefined) filter.billable = input.billable;

  const rounding = Rounding.of(
    input.rounding ?? config.rounding.mode,
    input.roundingMinutes ?? config.rounding.minutes,
  );

  return container.reportService.build(workspace, filter, {
    rounding,
    ...(label ? { rangeLabel: label } : {}),
  });
}

function summarize(data: ReportData): Record<string, unknown> {
  return {
    workspace: data.workspace.slug,
    filterLabel: data.filterLabel,
    entryCount: data.entries.length,
    totalHours: Number(data.totalHours.toFixed(2)),
    billableHours: Number(data.billableHours.toFixed(2)),
    nonBillableHours: Number(data.nonBillableHours.toFixed(2)),
    billableAmount: serializeMoney(data.billableAmount),
    hoursByProject: data.hoursByProject.map((p) => ({
      project: p.projectName,
      hours: Number(p.hours.toFixed(2)),
      billableHours: Number(p.billableHours.toFixed(2)),
      amount: serializeMoney(p.amount),
      rate: serializeMoney(p.rate),
    })),
    hoursByDay: data.hoursByDay.map((d) => ({ date: d.date, hours: Number(d.hours.toFixed(2)) })),
  };
}

/** Aggregated report + file-export tools over time entries (mirrors `tck report`/`tck export`). */
export function registerReportTools(server: McpServer, container: Container): void {
  server.registerTool(
    "get_report_summary",
    {
      title: "Get report summary",
      description:
        "Aggregate time entries into totals, per-project and per-day breakdowns, and billable amounts",
      inputSchema: reportFilterShape,
    },
    safeHandler(async (input) => {
      const data = await buildReportData(container, input);
      return jsonResult(summarize(data));
    }),
  );

  server.registerTool(
    "export_report_pdf",
    {
      title: "Export report as PDF",
      description: "Build the same report as get_report_summary and write it as a PDF file on disk",
      inputSchema: { ...reportFilterShape, outputPath: z.string().describe("Where to write the PDF") },
    },
    safeHandler(async ({ outputPath, ...input }) => {
      const data = await buildReportData(container, input);
      await container.pdfReportExporter.export(data, outputPath);
      return jsonResult({ path: outputPath, ...summarize(data) });
    }),
  );

  server.registerTool(
    "export_report_csv",
    {
      title: "Export report as CSV",
      description: "Build the same report as get_report_summary and write it as a CSV file on disk",
      inputSchema: { ...reportFilterShape, outputPath: z.string().describe("Where to write the CSV") },
    },
    safeHandler(async ({ outputPath, ...input }) => {
      const data = await buildReportData(container, input);
      await container.csvReportExporter.export(data, outputPath);
      return jsonResult({ path: outputPath, ...summarize(data) });
    }),
  );
}
