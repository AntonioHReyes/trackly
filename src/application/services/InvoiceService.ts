import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { Workspace } from "../../domain/entities/Workspace.js";
import type { InvoiceDetails } from "../../domain/value-objects/InvoiceDetails.js";
import type { Money } from "../../domain/value-objects/Money.js";
import { Rounding } from "../../domain/value-objects/Rounding.js";
import type { ReportService } from "./ReportService.js";

export interface InvoiceLineItem {
  projectId: string | null;
  projectName: string;
  hours: number;
  rate: Money;
  amount: Money;
}

/** Knobs specific to building an invoice, mirroring `ReportOptions`. */
export interface InvoiceOptions {
  rounding?: Rounding;
  /** Shortcut name (`Last month`, ...) shown in the invoice's period label. */
  rangeLabel?: string;
}

export interface InvoiceData {
  workspace: Workspace;
  details: InvoiceDetails;
  /** Human-readable summary of the period covered, for the PDF header. */
  filterLabel: string;
  lineItems: InvoiceLineItem[];
  /** Billable hours that had no resolvable rate, so they're excluded from `lineItems`. */
  unbilledHours: number;
  subtotal: Money;
  taxAmount: Money;
  total: Money;
}

/**
 * Turns tracked time into an invoice (`tck invoice pdf`, see SPEC.md's
 * Invoices command). Reuses `ReportService` for the aggregation — an
 * invoice is just billable hours, grouped by project and priced, so there's
 * no separate query path to keep in sync.
 */
export class InvoiceService {
  constructor(private readonly reports: ReportService) {}

  async build(
    workspace: Workspace,
    filter: TimeEntryFilter,
    details: InvoiceDetails,
    options: InvoiceOptions = {},
  ): Promise<InvoiceData> {
    const report = await this.reports.build(
      workspace,
      { ...filter, billable: true },
      {
        rounding: options.rounding ?? Rounding.none(),
        showRounding: false,
        ...(options.rangeLabel ? { rangeLabel: options.rangeLabel } : {}),
      },
    );

    // Hours without a resolvable rate can't be priced, so they're reported
    // separately rather than silently invoiced at zero.
    const lineItems: InvoiceLineItem[] = [];
    let unbilledHours = 0;
    for (const project of report.hoursByProject) {
      if (project.rate) {
        lineItems.push({
          projectId: project.projectId,
          projectName: project.projectName,
          hours: project.billableHours,
          rate: project.rate,
          amount: project.amount,
        });
      } else {
        unbilledHours += project.billableHours;
      }
    }

    const subtotal = report.billableAmount;
    const taxAmount = subtotal.multiply(details.taxRate / 100);
    return {
      workspace,
      details,
      filterLabel: report.filterLabel,
      lineItems,
      unbilledHours,
      subtotal,
      taxAmount,
      total: subtotal.add(taxAmount),
    };
  }
}
