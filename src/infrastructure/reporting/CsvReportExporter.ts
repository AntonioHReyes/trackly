import { writeFile } from "node:fs/promises";
import type { ReportExporter } from "../../application/ports/ReportExporter.js";
import type { ReportData } from "../../application/services/ReportService.js";

const HEADERS = [
  "id",
  "description",
  "project",
  "tags",
  "start",
  "end",
  "duration_hours",
  "duration_hhmm",
  "billable",
  "amount",
  "currency",
  "commit",
];

/** Quotes a field per RFC 4180 only when it needs it (comma, quote, or newline). */
function csvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Renders decimal hours as `HH:mm` (e.g. `1.5` -> `01:30`), for readers who'd rather not do the math. */
function formatHoursAsHHMM(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(wholeHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Flat CSV dump of every entry in a `ReportData` (`tck export csv`). */
export class CsvReportExporter implements ReportExporter {
  async export(data: ReportData, outPath: string): Promise<void> {
    const rows = data.entries.map((entry) => {
      const project = entry.projectId ? (data.projectNameById.get(entry.projectId) ?? "") : "";
      const tags = entry.tagIds.map((id) => data.tagNameById.get(id) ?? id).join(";");
      const amount = data.amountByEntryId.get(entry.id);
      // Rounded duration, so the CSV totals match the PDF's.
      const hours = data.hoursByEntryId.get(entry.id) ?? entry.durationHours();
      return [
        entry.id,
        entry.description,
        project,
        tags,
        entry.startTs.toISOString(),
        entry.endTs ? entry.endTs.toISOString() : "",
        hours.toFixed(4),
        formatHoursAsHHMM(hours),
        entry.billable ? "true" : "false",
        amount ? amount.toDecimal().toFixed(2) : "",
        data.workspace.currency,
        entry.git?.commit ?? "",
      ].map(csvField);
    });

    const lines = [HEADERS.join(","), ...rows.map((row) => row.join(","))];
    await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  }
}
