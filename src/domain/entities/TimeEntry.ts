import { randomUUID } from "node:crypto";
import { ValidationError, InvalidStateError } from "../errors/DomainError.js";

export type TimeEntrySource = "manual" | "git-hook";

export interface GitMetadata {
  repo: string;
  commit: string;
  branch: string;
}

export interface TimeEntryProps {
  id: string;
  workspaceId: string;
  projectId: string | null;
  description: string;
  startTs: Date;
  endTs: Date | null;
  billable: boolean;
  git: GitMetadata | null;
  source: TimeEntrySource;
  tagIds: readonly string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A span of tracked work, running (`endTs === null`) or finished. Tag
 * membership is carried as `tagIds` for domain-level convenience; the
 * `TimeEntryTag` join table is a persistence detail owned by the repository.
 */
export class TimeEntry {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string | null;
  readonly description: string;
  readonly startTs: Date;
  readonly endTs: Date | null;
  readonly billable: boolean;
  readonly git: GitMetadata | null;
  readonly source: TimeEntrySource;
  readonly tagIds: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: TimeEntryProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.projectId = props.projectId;
    this.description = props.description;
    this.startTs = props.startTs;
    this.endTs = props.endTs;
    this.billable = props.billable;
    this.git = props.git;
    this.source = props.source;
    this.tagIds = props.tagIds;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /** Starts a new, currently-running entry (`tck start`). */
  static start(params: {
    workspaceId: string;
    description: string;
    projectId?: string | null;
    billable?: boolean;
    tagIds?: readonly string[];
    startTs?: Date;
  }): TimeEntry {
    const now = new Date();
    return new TimeEntry({
      id: randomUUID(),
      workspaceId: params.workspaceId,
      projectId: params.projectId ?? null,
      description: TimeEntry.validateDescription(params.description),
      startTs: params.startTs ?? now,
      endTs: null,
      billable: params.billable ?? true,
      git: null,
      source: "manual",
      tagIds: params.tagIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  /** Creates an already-finished entry with an explicit range (`tck add`). */
  static addManual(params: {
    workspaceId: string;
    description: string;
    startTs: Date;
    endTs: Date;
    projectId?: string | null;
    billable?: boolean;
    tagIds?: readonly string[];
  }): TimeEntry {
    TimeEntry.validateRange(params.startTs, params.endTs);
    const now = new Date();
    return new TimeEntry({
      id: randomUUID(),
      workspaceId: params.workspaceId,
      projectId: params.projectId ?? null,
      description: TimeEntry.validateDescription(params.description),
      startTs: params.startTs,
      endTs: params.endTs,
      billable: params.billable ?? true,
      git: null,
      source: "manual",
      tagIds: params.tagIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstruct(props: TimeEntryProps): TimeEntry {
    return new TimeEntry(props);
  }

  isRunning(): boolean {
    return this.endTs === null;
  }

  /** Stops a running entry at `endTs` (defaults to now). */
  stop(endTs: Date = new Date()): TimeEntry {
    if (!this.isRunning()) {
      throw new InvalidStateError(`Time entry ${this.id} is already stopped`);
    }
    TimeEntry.validateRange(this.startTs, endTs);
    return new TimeEntry({ ...this, endTs, updatedAt: new Date() });
  }

  /** Attaches commit metadata from the git post-commit hook. */
  attachGit(git: GitMetadata): TimeEntry {
    return new TimeEntry({ ...this, git, source: "git-hook", updatedAt: new Date() });
  }

  withUpdates(updates: {
    description?: string;
    projectId?: string | null;
    startTs?: Date;
    endTs?: Date | null;
    billable?: boolean;
    tagIds?: readonly string[];
  }): TimeEntry {
    const startTs = updates.startTs ?? this.startTs;
    const endTs = updates.endTs !== undefined ? updates.endTs : this.endTs;
    if (endTs !== null) {
      TimeEntry.validateRange(startTs, endTs);
    }
    return new TimeEntry({
      ...this,
      description:
        updates.description !== undefined
          ? TimeEntry.validateDescription(updates.description)
          : this.description,
      projectId: updates.projectId !== undefined ? updates.projectId : this.projectId,
      startTs,
      endTs,
      billable: updates.billable !== undefined ? updates.billable : this.billable,
      tagIds: updates.tagIds ?? this.tagIds,
      updatedAt: new Date(),
    });
  }

  /** Duration in milliseconds; a running entry is measured against `now`. */
  durationMs(now: Date = new Date()): number {
    return (this.endTs ?? now).getTime() - this.startTs.getTime();
  }

  durationHours(now: Date = new Date()): number {
    return this.durationMs(now) / (1000 * 60 * 60);
  }

  private static validateDescription(description: string): string {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      throw new ValidationError("Time entry description cannot be empty");
    }
    return trimmed;
  }

  private static validateRange(start: Date, end: Date): void {
    // `<` (not `<=`): a zero-duration entry — started and stopped within the
    // same millisecond — is a legitimate, if unusual, recording.
    if (end.getTime() < start.getTime()) {
      throw new ValidationError(
        `Time entry end (${end.toISOString()}) cannot be before start (${start.toISOString()})`,
      );
    }
  }
}
