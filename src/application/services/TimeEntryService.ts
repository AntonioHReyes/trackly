import { TimeEntry, type GitMetadata } from "../../domain/entities/TimeEntry.js";
import type { Project } from "../../domain/entities/Project.js";
import type { WorkspaceRepository } from "../../domain/repositories/WorkspaceRepository.js";
import type {
  TimeEntryFilter,
  TimeEntryRepository,
} from "../../domain/repositories/TimeEntryRepository.js";
import type { ProjectRepository } from "../../domain/repositories/ProjectRepository.js";
import {
  NotFoundError,
  InvalidStateError,
  ConflictError,
} from "../../domain/errors/DomainError.js";

export interface TimeEntryEdit {
  description?: string;
  projectId?: string | null;
  startTs?: Date;
  endTs?: Date | null;
  billable?: boolean;
  tagIds?: readonly string[];
  /**
   * Manual override for the entry's billed rate (e.g. a one-off higher rate
   * for a single entry) — takes precedence over the re-snapshot that a
   * `projectId` change would otherwise trigger. `null` marks it unbilled.
   */
  rate?: number | null;
}

/**
 * Start/stop/add/edit/rm/status/list for time entries (see SPEC.md's
 * Entries commands). Enforces the "one running entry per workspace" rule —
 * starting a new entry auto-stops whatever was running (one timer at a time).
 */
export class TimeEntryService {
  constructor(
    private readonly entries: TimeEntryRepository,
    private readonly projects: ProjectRepository,
    private readonly workspaces: WorkspaceRepository,
  ) {}

  async start(params: {
    workspaceId: string;
    description: string;
    projectId?: string | null;
    billable?: boolean;
    tagIds?: readonly string[];
    /** Manual override; when omitted, resolved from the project/workspace rate. */
    rate?: number | null;
  }): Promise<TimeEntry> {
    const project = params.projectId
      ? await this.assertProjectInWorkspace(params.projectId, params.workspaceId)
      : null;
    const running = await this.entries.findRunning(params.workspaceId);
    if (running) {
      await this.entries.save(running.stop());
    }
    const rate =
      params.rate !== undefined ? params.rate : await this.resolveRate(params.workspaceId, project);
    const entry = TimeEntry.start({ ...params, rate });
    await this.entries.save(entry);
    return entry;
  }

  async stop(workspaceId: string): Promise<TimeEntry> {
    const running = await this.entries.findRunning(workspaceId);
    if (!running) {
      throw new InvalidStateError("No time entry is currently running");
    }
    const stopped = running.stop();
    await this.entries.save(stopped);
    return stopped;
  }

  async addManual(params: {
    workspaceId: string;
    description: string;
    startTs: Date;
    endTs: Date;
    projectId?: string | null;
    billable?: boolean;
    tagIds?: readonly string[];
    /** Manual override; when omitted, resolved from the project/workspace rate. */
    rate?: number | null;
  }): Promise<TimeEntry> {
    const project = params.projectId
      ? await this.assertProjectInWorkspace(params.projectId, params.workspaceId)
      : null;
    const rate =
      params.rate !== undefined ? params.rate : await this.resolveRate(params.workspaceId, project);
    const entry = TimeEntry.addManual({ ...params, rate });
    await this.entries.save(entry);
    return entry;
  }

  async edit(id: string, updates: TimeEntryEdit): Promise<TimeEntry> {
    const entry = await this.getById(id);
    // An explicit `rate` always wins. Otherwise, reassigning the project
    // changes which rate applies, so it's re-snapshotted here too — every
    // other field leaves the entry's billed rate untouched, same as the git
    // metadata on it.
    let rateUpdate: { rate: number | null } | Record<string, never> = {};
    if (updates.rate !== undefined) {
      rateUpdate = { rate: updates.rate };
    } else if (updates.projectId !== undefined) {
      const project = updates.projectId
        ? await this.assertProjectInWorkspace(updates.projectId, entry.workspaceId)
        : null;
      rateUpdate = { rate: await this.resolveRate(entry.workspaceId, project) };
    }
    const updated = entry.withUpdates({ ...updates, ...rateUpdate });
    await this.entries.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const entry = await this.getById(id);
    await this.entries.delete(entry.id);
  }

  /**
   * Tags the running entry with commit metadata from a git hook (`tck
   * git-hook attach`), stopping it too when `stop` is set — normally sourced
   * from the `git-hook-stops-timer` config default.
   */
  async attachGit(
    workspaceId: string,
    git: GitMetadata,
    options: { stop?: boolean } = {},
  ): Promise<TimeEntry> {
    const running = await this.entries.findRunning(workspaceId);
    if (!running) {
      throw new InvalidStateError("No time entry is currently running");
    }
    const tagged = running.attachGit(git);
    const result = options.stop ? tagged.stop() : tagged;
    await this.entries.save(result);
    return result;
  }

  async status(workspaceId: string): Promise<TimeEntry | null> {
    return this.entries.findRunning(workspaceId);
  }

  async list(filter: TimeEntryFilter): Promise<TimeEntry[]> {
    return this.entries.findByFilter(filter);
  }

  /** Resolves a full id or an unambiguous id prefix (e.g. `tck rm e0b5`). */
  async getById(id: string): Promise<TimeEntry> {
    const exact = await this.entries.findById(id);
    if (exact) return exact;

    const matches = await this.entries.findByIdPrefix(id);
    if (matches.length === 0) {
      throw new NotFoundError("Time entry", id);
    }
    const [match, ...rest] = matches;
    if (!match || rest.length > 0) {
      const ids = matches.map((m) => m.id).join(", ");
      throw new ConflictError(`"${id}" matches multiple time entries: ${ids}`);
    }
    return match;
  }

  private async assertProjectInWorkspace(projectId: string, workspaceId: string): Promise<Project> {
    const project = await this.projects.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundError("Project", projectId);
    }
    return project;
  }

  /** Resolves the rate to snapshot on an entry: project rate, else workspace default. */
  private async resolveRate(workspaceId: string, project: Project | null): Promise<number | null> {
    const workspace = await this.workspaces.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceId);
    }
    const rate = project ? project.resolveRate(workspace) : workspace.resolveDefaultRate();
    return rate ? rate.toDecimal() : null;
  }
}
