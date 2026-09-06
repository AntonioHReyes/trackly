import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";
import { addInvoiceOptions, buildInvoiceData, type InvoiceCliOptions } from "./invoiceOptions.js";
import { registerInvoiceConfigCommands } from "./invoiceConfig.js";

type InvoiceOptions = InvoiceCliOptions & {
  output?: string;
};

/** `tck invoice pdf` (see SPEC.md's Invoices command). */
export function registerInvoiceCommands(program: Command, container: Container): void {
  const invoice = program.command("invoice").description("Generate invoices from billable time");

  const pdf = addInvoiceOptions(invoice.command("pdf"))
    .description("Generate a PDF invoice (line items priced by project, tax, total)")
    .option("-o, --output <path>", "output file path", "invoice.pdf");

  registerInvoiceConfigCommands(invoice, container);

  pdf.action(async (options: InvoiceOptions) => {
    const data = await buildInvoiceData(program, container, options);
    const outPath = options.output ?? "invoice.pdf";
    await container.pdfInvoiceExporter.export(data, outPath);
    ui.success(`Invoice written to ${ui.code(outPath)}`);
  });
}
