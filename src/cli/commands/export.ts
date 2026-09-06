import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";
import {
  addReportFilterOptions,
  buildReportData,
  type ReportFilterOptions,
} from "./reportOptions.js";
import { addPresetOption } from "./presetOption.js";

type ExportOptions = ReportFilterOptions & {
  output?: string;
};

/** `tck export csv` — same filters as `report pdf` (see SPEC.md's Export command). */
export function registerExportCommands(program: Command, container: Container): void {
  const exportCmd = program.command("export").description("Export time entries to a file");
  const csv = addPresetOption(addReportFilterOptions(exportCmd.command("csv")))
    .description("Export a flat CSV dump of time entries")
    .option("-o, --output <path>", "output file path", "export.csv");

  csv.action(async (options: ExportOptions) => {
    const data = await buildReportData(program, container, options);
    const outPath = options.output ?? "export.csv";
    await container.csvReportExporter.export(data, outPath);
    ui.success(`Exported ${data.entries.length} entries to ${ui.code(outPath)}`);
  });
}
