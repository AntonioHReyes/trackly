import type { TimeEntry } from "../../../src/domain/entities/TimeEntry.js";
import type {
  TimeEntryFilter,
  TimeEntryRepository,
} from "../../../src/domain/repositories/TimeEntryRepository.js";

export class InMemoryTimeEntryRepository implements TimeEntryRepository {
  private readonly byId = new Map<string, TimeEntry>();

  async save(entry: TimeEntry): Promise<void> {
    this.byId.set(entry.id, entry);
  }

  async findById(id: string): Promise<TimeEntry | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdPrefix(prefix: string): Promise<TimeEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.id.startsWith(prefix))
      .sort((a, b) => a.startTs.getTime() - b.startTs.getTime());
  }

  async findRunning(workspaceId: string): Promise<TimeEntry | null> {
    return (
      [...this.byId.values()].find((e) => e.workspaceId === workspaceId && e.isRunning()) ?? null
    );
  }

  async findByFilter(filter: TimeEntryFilter): Promise<TimeEntry[]> {
    return [...this.byId.values()]
      .filter((e) => e.workspaceId === filter.workspaceId)
      .filter((e) => !filter.range || filter.range.contains(e.startTs))
      .filter((e) => !filter.projectId || e.projectId === filter.projectId)
      .filter((e) => !filter.tagId || e.tagIds.includes(filter.tagId))
      .filter((e) => filter.billable === undefined || e.billable === filter.billable)
      .sort((a, b) => a.startTs.getTime() - b.startTs.getTime());
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}
