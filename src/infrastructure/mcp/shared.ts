import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DateRange } from "../../domain/value-objects/DateRange.js";
import {
  resolveDateRangeShortcut,
  type DateRangeShortcut,
} from "../../application/services/DateRangeShortcuts.js";
import type { WeekStart } from "../../domain/value-objects/WeekStart.js";
import { DomainError } from "../../domain/errors/DomainError.js";
import type { Workspace } from "../../domain/entities/Workspace.js";
import type { Project } from "../../domain/entities/Project.js";
import type { Tag } from "../../domain/entities/Tag.js";
import type { TimeEntry } from "../../domain/entities/TimeEntry.js";
import type { Money } from "../../domain/value-objects/Money.js";

const RANGE_SHORTCUTS: readonly DateRangeShortcut[] = [
  "today",
  "yesterday",
  "this-week",
  "last-week",
  "this-month",
  "last-month",
  "last-7-days",
  "last-30-days",
  "this-year",
  "last-year",
];

/** Zod fields shared by every tool that accepts a date range (shortcut or explicit bounds). */
export const dateRangeShape = {
  range: z
    .enum(RANGE_SHORTCUTS as [DateRangeShortcut, ...DateRangeShortcut[]])
    .optional()
    .describe("Calendar shortcut for the date range, mutually exclusive with from/to"),
  from: z.string().optional().describe("Range start (ISO datetime), used with `to`"),
  to: z.string().optional().describe("Range end (ISO datetime), used with `from`"),
};

export interface RangeSelection {
  range: DateRange | undefined;
  label: string | undefined;
}

/** Mirrors `resolveDateRangeSelection` (CLI) for the `range`/`from`/`to` MCP shape. */
export function resolveRangeInput(
  input: { range?: DateRangeShortcut | undefined; from?: string | undefined; to?: string | undefined },
  weekStart: WeekStart,
): RangeSelection {
  if (input.range) {
    return {
      range: resolveDateRangeShortcut(input.range, weekStart),
      label: input.range,
    };
  }
  if (input.from && input.to) {
    return { range: DateRange.of(new Date(input.from), new Date(input.to)), label: undefined };
  }
  return { range: undefined, label: undefined };
}

export function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function jsonResult(data: unknown): CallToolResult {
  return textResult(JSON.stringify(data, null, 2));
}

/**
 * Every tool handler is wrapped with this so a `DomainError` (bad input,
 * not-found, conflict) comes back to the AI client as a normal tool error
 * instead of crashing the MCP connection — mirrors how `src/cli/index.ts`
 * turns `DomainError` into a clean CLI message instead of a stack trace.
 */
export function safeHandler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<CallToolResult>,
): (...args: Args) => Promise<CallToolResult> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof DomainError) {
        return { content: [{ type: "text", text: error.message }], isError: true };
      }
      throw error;
    }
  };
}

export function serializeMoney(money: Money | null): { amount: number; currency: string } | null {
  return money ? { amount: money.toDecimal(), currency: money.currency } : null;
}

export function serializeWorkspace(workspace: Workspace): Record<string, unknown> {
  return {
    slug: workspace.slug,
    name: workspace.name,
    currency: workspace.currency,
    defaultHourlyRate: workspace.defaultHourlyRate,
  };
}

export function serializeProject(project: Project): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    client: project.client,
    color: project.color,
    hourlyRate: project.hourlyRate,
    archived: project.archived,
  };
}

export function serializeTag(tag: Tag): Record<string, unknown> {
  return { id: tag.id, name: tag.name };
}

export function serializeEntry(
  entry: TimeEntry,
  names: { projectName?: string | undefined; tagNames?: string[] | undefined } = {},
): Record<string, unknown> {
  return {
    id: entry.id,
    description: entry.description,
    projectId: entry.projectId,
    projectName: names.projectName ?? null,
    startTs: entry.startTs.toISOString(),
    endTs: entry.endTs?.toISOString() ?? null,
    running: entry.isRunning(),
    durationHours: Number(entry.durationHours().toFixed(4)),
    billable: entry.billable,
    tagIds: entry.tagIds,
    tagNames: names.tagNames ?? [],
  };
}
