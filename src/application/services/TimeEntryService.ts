import { TimeEntry } from "../../domain/entities/TimeEntry.js";
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
  ) {}

  async start(params: {
    workspaceId: string;
    description: string;
    projectId?: string | null;
    billable?: boolean;
    tagIds?: readonly string[];
  }): Promise<TimeEntry> {
    if (params.projectId) {
      await this.assertProjectInWorkspace(params.projectId, params.workspaceId);
    }
    const running = await this.entries.findRunning(params.workspaceId);
    if (running) {
      await this.entries.save(running.stop());
    }
    const entry = TimeEntry.start(params);
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
  }): Promise<TimeEntry> {
    if (params.projectId) {
      await this.assertProjectInWorkspace(params.projectId, params.workspaceId);
    }
    const entry = TimeEntry.addManual(params);
    await this.entries.save(entry);
    return entry;
  }

  async edit(id: string, updates: TimeEntryEdit): Promise<TimeEntry> {
    const entry = await this.getById(id);
    if (updates.projectId) {
      await this.assertProjectInWorkspace(updates.projectId, entry.workspaceId);
    }
    const updated = entry.withUpdates(updates);
    await this.entries.save(updated);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const entry = await this.getById(id);
    await this.entries.delete(entry.id);
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

  private async assertProjectInWorkspace(projectId: string, workspaceId: string): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundError("Project", projectId);
    }
  }
}
