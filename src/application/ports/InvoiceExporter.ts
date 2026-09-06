import type { InvoiceData } from "../services/InvoiceService.js";

/**
 * Renders an `InvoiceData` snapshot to a file. Implemented by infra
 * (`PdfInvoiceExporter`) — the application layer only knows it can hand
 * over a priced invoice and get a file written.
 */
export interface InvoiceExporter {
  export(data: InvoiceData, outPath: string): Promise<void>;
}
