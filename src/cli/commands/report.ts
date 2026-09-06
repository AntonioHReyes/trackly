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

type PdfOptions = ReportFilterOptions & {
  output?: string;
};

type ChartOptions = ReportFilterOptions & {
  section?: "days" | "projects" | "both";
};

/** `tck report pdf`/`tck report chart` — see the "Reports" section in README.md. */
export function registerReportCommands(program: Command, container: Container): void {
  const report = program.command("report").description("Generate reports over time entries");

  const pdf = addPresetOption(addReportFilterOptions(report.command("pdf")))
    .description("Generate a PDF report (charts + billable totals)")
    .option("--hide-rounding", "omit the rounding note from the header and summary cards")
    .option("-o, --output <path>", "output file path", "report.pdf");

  const chart = addPresetOption(addReportFilterOptions(report.command("chart")))
    .description("Render hours-by-day and hours-by-project bar charts in the terminal")
    .option(
      "--section <which>",
      "which chart(s) to show: days | projects | both",
      "both",
    );

  registerReportPresetCommands(report, container);

  pdf.action(async (options: PdfOptions) => {
    const data = await buildReportData(program, container, options);
    const outPath = options.output ?? "report.pdf";
    await container.pdfReportExporter.export(data, outPath);
    ui.success(`Report written to ${ui.code(outPath)}`);
    ui.hint(
      `${data.entries.length} entries · ${data.totalHours.toFixed(2)}h · ${data.filterLabel}`,
    );
  });

  chart.action(async (options: ChartOptions) => {
    const data = await buildReportData(program, container, options);
    ui.blank();
    ui.heading(data.filterLabel);
    ui.hint(
      `${data.entries.length} entries · ${data.totalHours.toFixed(2)}h total · ${data.billableHours.toFixed(2)}h billable · ${data.billableAmount.toString()}`,
    );
    ui.blank();

    const section = options.section ?? "both";
    if (section === "days" || section === "both") {
      ui.print(ui.chartHeading("Hours by day"));
      ui.print(ui.renderDailyHoursChart(data.hoursByDay));
      ui.blank();
    }
    if (section === "projects" || section === "both") {
      ui.print(ui.chartHeading("Hours by project"));
      ui.print(ui.renderProjectHoursChart(data.hoursByProject));
      ui.blank();
    }
  });
}
