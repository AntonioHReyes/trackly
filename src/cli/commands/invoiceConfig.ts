import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";
import { ValidationError } from "../../domain/errors/DomainError.js";

interface InvoiceConfigSetOptions {
  billTo?: string;
  taxRate?: string;
  notes?: string;
  numberTemplate?: string;
}

/** `tck invoice config set/get` — persisted defaults (bill-to, tax rate, notes, numbering). */
export function registerInvoiceConfigCommands(invoice: Command, container: Container): void {
  const config = invoice.command("config").description("Manage saved invoice defaults");

  config
    .command("set")
    .description("Set one or more invoice defaults")
    .option("--bill-to <text>", "default recipient block, newline-separated (e.g. \"Acme Corp\\n123 Main St\")")
    .option("--tax-rate <percent>", "default tax percentage applied to the subtotal, e.g. 21")
    .option("--notes <text>", "default notes printed at the bottom of the invoice")
    .option("--number-template <template>", 'invoice numbering template, e.g. "INV-2026-%03d"')
    .action((options: InvoiceConfigSetOptions) => {
      if (Object.values(options).every((value) => value === undefined)) {
        throw new ValidationError(
          "Pass at least one of --bill-to, --tax-rate, --notes, --number-template",
        );
      }
      if (options.billTo !== undefined) {
        container.invoiceConfigStore.setBillTo(options.billTo.replaceAll("\\n", "\n"));
      }
      if (options.notes !== undefined) container.invoiceConfigStore.setNotes(options.notes);
      if (options.numberTemplate !== undefined) {
        container.invoiceConfigStore.setNumberTemplate(options.numberTemplate);
      }
      if (options.taxRate !== undefined) {
        const rate = Number.parseFloat(options.taxRate);
        if (!Number.isFinite(rate)) {
          throw new ValidationError(`--tax-rate must be a number, got "${options.taxRate}"`);
        }
        container.invoiceConfigStore.setTaxRate(rate);
      }
      ui.success("Invoice defaults updated");
    });

  config
    .command("get")
    .description("Print the saved invoice defaults")
    .action(() => {
      const values = container.invoiceConfigStore.read();
      ui.print(
        ui.renderTable(
          ["Key", "Value"],
          [
            ["bill-to", values.billTo ?? "(none)"],
            ["tax-rate", values.taxRate !== null ? `${values.taxRate}%` : "(none)"],
            ["notes", values.notes ?? "(none)"],
            ["number-template", values.numberTemplate ?? "(none)"],
            ["next-number", String(values.nextNumber)],
          ],
        ),
      );
    });
}
