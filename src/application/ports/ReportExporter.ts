import type { ReportData } from "../services/ReportService.js";

/**
 * Renders a `ReportData` snapshot to a file. Implemented by infra
 * (`PdfReportExporter`, `CsvReportExporter`) — the application layer only
 * knows it can hand over aggregated data and get a file written.
 */
export interface ReportExporter {
  export(data: ReportData, outPath: string): Promise<void>;
}
