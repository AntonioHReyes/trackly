import type { Command } from "commander";
import type { Container } from "../container.js";
import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { InvoiceData } from "../../application/services/InvoiceService.js";
import { InvoiceDetails } from "../../domain/value-objects/InvoiceDetails.js";
import { ValidationError } from "../../domain/errors/DomainError.js";
import { addDateRangeOptions, resolveDateRangeSelection } from "./dateRangeOptions.js";
import type { DateRangeCliOptions } from "./dateRangeOptions.js";
import { addRoundingOptions, resolveRounding } from "./roundingOptions.js";
import type { RoundingCliOptions } from "./roundingOptions.js";
import { resolveProjectId, resolveProjectIdsByClient, resolveTagIds } from "./lookups.js";
import { addPresetOption, applyPreset, type PresetCliOptions } from "./presetOption.js";

interface WorkspaceOpts {
  workspace?: string;
}

/** Everything `invoice pdf` accepts, minus the output path. */
export type InvoiceCliOptions = DateRangeCliOptions &
  RoundingCliOptions &
  PresetCliOptions & {
    project?: string;
    client?: string;
    tag?: string;
    /** Omit to auto-generate from `tck invoice config set --number-template ...`. */
    number?: string;
    billTo?: string;
    issueDate?: string;
    dueDate?: string;
    taxRate?: string;
    notes?: string;
  };

/** Adds the flags `invoice pdf` accepts: period filter, rounding, and invoice metadata. */
export function addInvoiceOptions(command: Command): Command {
  return addPresetOption(addRoundingOptions(addDateRangeOptions(command)))
    .option(
      "--number <id>",
      "invoice number/identifier, e.g. INV-2026-001 (default: auto from invoice config numbering)",
    )
    .option("--project <name>", "only include this project's entries")
    .option("--client <name>", "only include this client's projects")
    .option("--tag <name>", "only include entries with this tag")
    .option("--bill-to <text>", "recipient block, newline-separated (default: invoice config bill-to)")
    .option("--issue-date <date>", "invoice issue date (ISO), defaults to today")
    .option("--due-date <date>", "payment due date (ISO)")
    .option("--tax-rate <percent>", "tax percentage applied to the subtotal (default: invoice config tax-rate)")
    .option("--notes <text>", "free-form notes printed at the bottom (default: invoice config notes)");
}

/**
 * Resolves the active workspace and every flag into a priced `InvoiceData` —
 * the single path `invoice pdf` renders from, mirroring `buildReportData`.
 */
export async function buildInvoiceData(
  program: Command,
  container: Container,
  rawOptions: InvoiceCliOptions,
): Promise<InvoiceData> {
  const options = applyPreset(rawOptions, container.reportPresetStore);
  const workspace = await container.workspaceService.resolveActive(
    (program.opts() as WorkspaceOpts).workspace,
  );
  const config = container.configStore.read();
  const { range, label } = resolveDateRangeSelection(options, config.weekStart);
  const projectId = options.project
    ? await resolveProjectId(container, workspace.id, options.project)
    : undefined;
  const projectIds = options.client
    ? await resolveProjectIdsByClient(container, workspace.id, options.client)
    : undefined;
  const tagId = options.tag
    ? (await resolveTagIds(container, workspace.id, options.tag))[0]
    : undefined;

  const filter: TimeEntryFilter = { workspaceId: workspace.id };
  if (range) filter.range = range;
  if (projectId) filter.projectId = projectId;
  if (projectIds) filter.projectIds = projectIds;
  if (tagId) filter.tagId = tagId;

  // Explicit flags win over the saved invoice defaults, the same way they
  // win over a `--preset`'s stored filters.
  const defaults = container.invoiceConfigStore.read();
  const number = options.number ?? container.invoiceConfigStore.nextInvoiceNumber();
  const billTo = options.billTo?.replaceAll("\\n", "\n") ?? defaults.billTo ?? null;
  const notes = options.notes ?? defaults.notes ?? null;
  const taxRate = options.taxRate ? Number.parseFloat(options.taxRate) : (defaults.taxRate ?? undefined);

  const details = InvoiceDetails.create({
    number,
    billTo,
    notes,
    dueDate: options.dueDate ? parseDate("--due-date", options.dueDate) : null,
    ...(options.issueDate ? { issueDate: parseDate("--issue-date", options.issueDate) } : {}),
    ...(taxRate !== undefined ? { taxRate } : {}),
  });

  return container.invoiceService.build(workspace, filter, details, {
    rounding: resolveRounding(options, config),
    ...(label ? { rangeLabel: label } : {}),
  });
}

function parseDate(flag: string, value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${flag} must be a valid date, got "${value}"`);
  }
  return date;
}
