import { JsonStore } from "./JsonStore.js";
import { invoiceConfigFilePath } from "./paths.js";
import { ValidationError } from "../../domain/errors/DomainError.js";

export interface InvoiceDefaults {
  billTo: string | null;
  taxRate: number | null;
  notes: string | null;
  /** e.g. `"INV-2026-%03d"` — `%d`/`%0Nd` is replaced with the zero-padded counter. */
  numberTemplate: string | null;
  /** The counter `nextInvoiceNumber()` will format and consume next. */
  nextNumber: number;
}

interface RawInvoiceConfig {
  billTo?: string;
  taxRate?: number;
  notes?: string;
  numberTemplate?: string;
  nextNumber?: number;
}

/**
 * Persists invoice defaults (`tck invoice config set/get`) so recurring
 * details — who's billed, the tax rate, the numbering scheme — don't need
 * retyping on every `invoice pdf` run. Unlike `InvoiceDetails` itself
 * (see its docstring), this *is* meant to be stored: it's the one exception
 * to "invoices are stateless", scoped to just the numbering counter and
 * reusable defaults, not to invoice history.
 */
export class InvoiceConfigStore {
  private readonly json: JsonStore<RawInvoiceConfig>;

  constructor(filePath: string = invoiceConfigFilePath()) {
    this.json = new JsonStore(filePath, {});
  }

  read(): InvoiceDefaults {
    const raw = this.json.read();
    return {
      billTo: raw.billTo ?? null,
      taxRate: typeof raw.taxRate === "number" ? raw.taxRate : null,
      notes: raw.notes ?? null,
      numberTemplate: raw.numberTemplate ?? null,
      nextNumber: raw.nextNumber ?? 1,
    };
  }

  setBillTo(billTo: string): void {
    this.json.update({ billTo });
  }

  setTaxRate(taxRate: number): void {
    this.json.update({ taxRate });
  }

  setNotes(notes: string): void {
    this.json.update({ notes });
  }

  setNumberTemplate(numberTemplate: string): void {
    this.json.update({ numberTemplate });
  }

  /**
   * Formats the next invoice number from the saved template and persists
   * the incremented counter. Consumes one number per call, so it must only
   * be called once an invoice is actually about to be generated — never
   * for a preview or a dry run.
   */
  nextInvoiceNumber(): string {
    const { numberTemplate, nextNumber } = this.read();
    if (!numberTemplate) {
      throw new ValidationError(
        'No --number given and no numbering template configured. Pass --number, or run ' +
          '`tck invoice config set --number-template "INV-2026-%03d"`.',
      );
    }
    const formatted = InvoiceConfigStore.format(numberTemplate, nextNumber);
    this.json.update({ nextNumber: nextNumber + 1 });
    return formatted;
  }

  private static format(template: string, counter: number): string {
    return template.replace(/%(\d*)d/g, (_match, widthDigits: string) => {
      const width = widthDigits ? Number(widthDigits) : 0;
      return width > 0 ? String(counter).padStart(width, "0") : String(counter);
    });
  }
}
