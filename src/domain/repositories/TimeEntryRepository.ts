import type { TimeEntry } from "../entities/TimeEntry.js";
import type { DateRange } from "../value-objects/DateRange.js";

/**
 * Combinable filters shared by `list`, `report`, and `export` (see
 * SPEC.md's Commands table) — one query shape for every read path.
 */
export interface TimeEntryFilter {
  workspaceId: string;
  range?: DateRange;
  projectId?: string;
  tagId?: string;
  billable?: boolean;
}

export interface TimeEntryRepository {
  save(entry: TimeEntry): Promise<void>;
  findById(id: string): Promise<TimeEntry | null>;
  /** Entries whose id starts with `prefix` — backs short-id lookup in `edit`/`rm`. */
  findByIdPrefix(prefix: string): Promise<TimeEntry[]>;
  /** The single running entry in a workspace, if any (`tck status`). */
  findRunning(workspaceId: string): Promise<TimeEntry | null>;
  findByFilter(filter: TimeEntryFilter): Promise<TimeEntry[]>;
  delete(id: string): Promise<void>;
}
