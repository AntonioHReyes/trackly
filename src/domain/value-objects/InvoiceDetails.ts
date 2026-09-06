import { ValidationError } from "../errors/DomainError.js";

export interface InvoiceDetailsProps {
  number: string;
  /** Free-form recipient block, e.g. `"Acme Corp\n123 Main St"` — rendered as-is, one line each. */
  billTo: string | null;
  issueDate: Date;
  dueDate: Date | null;
  /** Percentage (0–100), applied to the subtotal. */
  taxRate: number;
  notes: string | null;
}

/**
 * The metadata an invoice needs beyond what's already tracked (see
 * SPEC.md's Invoices command): who it's addressed to, when it's due, and
 * the tax rate to apply. This value object itself isn't persisted — each
 * `tck invoice pdf` run builds a fresh one, the same way a report's date
 * range is a one-off filter rather than stored state. Individual fields may
 * be pre-filled from `InvoiceConfigStore`'s saved defaults before reaching
 * here, but `create()` never reads config itself.
 */
export class InvoiceDetails {
  readonly number: string;
  readonly billTo: string | null;
  readonly issueDate: Date;
  readonly dueDate: Date | null;
  readonly taxRate: number;
  readonly notes: string | null;

  private constructor(props: InvoiceDetailsProps) {
    this.number = props.number;
    this.billTo = props.billTo;
    this.issueDate = props.issueDate;
    this.dueDate = props.dueDate;
    this.taxRate = props.taxRate;
    this.notes = props.notes;
  }

  static create(params: {
    number: string;
    billTo?: string | null;
    issueDate?: Date;
    dueDate?: Date | null;
    taxRate?: number;
    notes?: string | null;
  }): InvoiceDetails {
    const number = InvoiceDetails.validateNumber(params.number);
    const issueDate = params.issueDate ?? new Date();
    const dueDate = params.dueDate ?? null;
    if (dueDate && dueDate.getTime() < issueDate.getTime()) {
      throw new ValidationError("Invoice due date cannot be before the issue date");
    }
    const taxRate = params.taxRate ?? 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      throw new ValidationError(`Tax rate must be between 0 and 100, got ${taxRate}`);
    }
    return new InvoiceDetails({
      number,
      billTo: params.billTo?.trim() || null,
      issueDate,
      dueDate,
      taxRate,
      notes: params.notes?.trim() || null,
    });
  }

  private static validateNumber(number: string): string {
    const trimmed = number.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Invoice number cannot be empty");
    }
    return trimmed;
  }
}
