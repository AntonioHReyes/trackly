import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";
import {
  addReportFilterOptions,
  buildReportData,
  type ReportFilterOptions,
} from "./reportOptions.js";
import { addPresetOption } from "./presetOption.js";
import { registerReportPresetCommands } from "./reportPreset.js";

type ReportOptions = ReportFilterOptions & {
  output?: string;
};

/** `tck report pdf` (see SPEC.md's Reports command). */
export function registerReportCommands(program: Command, container: Container): void {
  const report = program.command("report").description("Generate reports over time entries");

  const pdf = addPresetOption(addReportFilterOptions(report.command("pdf")))
    .description("Generate a PDF report (charts + billable totals)")
    .option("--hide-rounding", "omit the rounding note from the header and summary cards")
    .option("-o, --output <path>", "output file path", "report.pdf");

  registerReportPresetCommands(report, container);

  pdf.action(async (options: ReportOptions) => {
    const data = await buildReportData(program, container, options);
    const outPath = options.output ?? "report.pdf";
    await container.pdfReportExporter.export(data, outPath);
    ui.success(`Report written to ${ui.code(outPath)}`);
    ui.hint(
      `${data.entries.length} entries · ${data.totalHours.toFixed(2)}h · ${data.filterLabel}`,
    );
  });
}
