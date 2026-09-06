import type { Command } from "commander";
import type { Container } from "../container.js";
import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { ReportData } from "../../application/services/ReportService.js";
import { addDateRangeOptions, resolveDateRangeSelection } from "./dateRangeOptions.js";
import type { DateRangeCliOptions } from "./dateRangeOptions.js";
import { addRoundingOptions, resolveRounding } from "./roundingOptions.js";
import type { RoundingCliOptions } from "./roundingOptions.js";
import { resolveProjectId, resolveTagIds } from "./lookups.js";
import { applyPreset, type PresetCliOptions } from "./presetOption.js";

interface WorkspaceOpts {
  workspace?: string;
}

/** Everything `report pdf` and `export csv` accept, minus the output path. */
export type ReportFilterOptions = DateRangeCliOptions &
  RoundingCliOptions &
  PresetCliOptions & {
    project?: string;
    tag?: string;
    billable?: boolean;
    nonBillable?: boolean;
    /** Only registered on `report pdf` — the CSV has no header to hide it from. */
    hideRounding?: boolean;
  };

/** Adds the filter flags shared by `report pdf` and `export csv`. */
export function addReportFilterOptions(command: Command): Command {
  return addRoundingOptions(addDateRangeOptions(command))
    .option("--project <name>", "filter by project name")
    .option("--tag <name>", "filter by tag name")
    .option("--billable", "only billable entries")
    .option("--non-billable", "only non-billable entries");
}

/**
 * Resolves the active workspace and every filter flag into aggregated
 * `ReportData` — the single path both exporters are fed from, so PDF and
 * CSV can never disagree about what a given set of flags means.
 */
export async function buildReportData(
  program: Command,
  container: Container,
  rawOptions: ReportFilterOptions,
): Promise<ReportData> {
  const options = applyPreset(rawOptions, container.reportPresetStore);
  const workspace = await container.workspaceService.resolveActive(
    (program.opts() as WorkspaceOpts).workspace,
  );
  const config = container.configStore.read();
  const { range, label } = resolveDateRangeSelection(options, config.weekStart);
  const projectId = options.project
    ? await resolveProjectId(container, workspace.id, options.project)
    : undefined;
  const tagId = options.tag
    ? (await resolveTagIds(container, workspace.id, options.tag))[0]
    : undefined;
  const billable = options.billable ? true : options.nonBillable ? false : undefined;

  const filter: TimeEntryFilter = { workspaceId: workspace.id };
  if (range) filter.range = range;
  if (projectId) filter.projectId = projectId;
  if (tagId) filter.tagId = tagId;
  if (billable !== undefined) filter.billable = billable;

  return container.reportService.build(workspace, filter, {
    rounding: resolveRounding(options, config),
    showRounding: !options.hideRounding,
    ...(label ? { rangeLabel: label } : {}),
  });
}
