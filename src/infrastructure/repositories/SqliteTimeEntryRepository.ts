import type Database from "better-sqlite3";
import {
  TimeEntry,
  type GitMetadata,
  type TimeEntrySource,
} from "../../domain/entities/TimeEntry.js";
import type {
  TimeEntryFilter,
  TimeEntryRepository,
} from "../../domain/repositories/TimeEntryRepository.js";

interface TimeEntryRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  description: string;
  start_ts: string;
  end_ts: string | null;
  billable: number;
  git_repo: string | null;
  git_commit: string | null;
  git_branch: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

interface TimeEntryTagRow {
  time_entry_id: string;
  tag_id: string;
}

export class SqliteTimeEntryRepository implements TimeEntryRepository {
  constructor(private readonly db: Database.Database) {}

  async save(entry: TimeEntry): Promise<void> {
    const persist = this.db.transaction((e: TimeEntry) => {
      this.db
        .prepare(
          `INSERT INTO time_entries (
             id, workspace_id, project_id, description, start_ts, end_ts,
             billable, git_repo, git_commit, git_branch, source, created_at, updated_at
           ) VALUES (
             @id, @workspaceId, @projectId, @description, @startTs, @endTs,
             @billable, @gitRepo, @gitCommit, @gitBranch, @source, @createdAt, @updatedAt
           )
           ON CONFLICT(id) DO UPDATE SET
             project_id = excluded.project_id,
             description = excluded.description,
             start_ts = excluded.start_ts,
             end_ts = excluded.end_ts,
             billable = excluded.billable,
             git_repo = excluded.git_repo,
             git_commit = excluded.git_commit,
             git_branch = excluded.git_branch,
             source = excluded.source,
             updated_at = excluded.updated_at`,
        )
        .run(SqliteTimeEntryRepository.toRow(e));

      this.db.prepare("DELETE FROM time_entry_tags WHERE time_entry_id = @id").run({ id: e.id });
      const insertTag = this.db.prepare(
        "INSERT INTO time_entry_tags (time_entry_id, tag_id) VALUES (@timeEntryId, @tagId)",
      );
      for (const tagId of e.tagIds) {
        insertTag.run({ timeEntryId: e.id, tagId });
      }
    });
    persist(entry);
  }

  async findById(id: string): Promise<TimeEntry | null> {
    const row = this.db
      .prepare<{ id: string }, TimeEntryRow>("SELECT * FROM time_entries WHERE id = @id")
      .get({ id });
    if (!row) return null;
    return SqliteTimeEntryRepository.toEntity(row, this.tagIdsFor(row.id));
  }

  async findByIdPrefix(prefix: string): Promise<TimeEntry[]> {
    const rows = this.db
      .prepare<{ prefix: string }, TimeEntryRow>(
        "SELECT * FROM time_entries WHERE id LIKE @prefix ORDER BY start_ts ASC",
      )
      .all({ prefix: `${prefix}%` });
    return rows.map((row) => SqliteTimeEntryRepository.toEntity(row, this.tagIdsFor(row.id)));
  }

  async findRunning(workspaceId: string): Promise<TimeEntry | null> {
    const row = this.db
      .prepare<{ workspaceId: string }, TimeEntryRow>(
        "SELECT * FROM time_entries WHERE workspace_id = @workspaceId AND end_ts IS NULL LIMIT 1",
      )
      .get({ workspaceId });
    if (!row) return null;
    return SqliteTimeEntryRepository.toEntity(row, this.tagIdsFor(row.id));
  }

  async findByFilter(filter: TimeEntryFilter): Promise<TimeEntry[]> {
    const { where, params } = SqliteTimeEntryRepository.buildWhere(filter);
    const tagJoin = filter.tagId ? "JOIN time_entry_tags tet ON tet.time_entry_id = te.id" : "";
    const rows = this.db
      .prepare<Record<string, unknown>, TimeEntryRow>(
        `SELECT te.* FROM time_entries te ${tagJoin} WHERE ${where} ORDER BY te.start_ts ASC`,
      )
      .all(params);

    const tagsByEntry = this.tagIdsForMany(rows.map((row) => row.id));
    return rows.map((row) =>
      SqliteTimeEntryRepository.toEntity(row, tagsByEntry.get(row.id) ?? []),
    );
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM time_entries WHERE id = @id").run({ id });
  }

  private tagIdsFor(timeEntryId: string): string[] {
    return this.db
      .prepare<{ timeEntryId: string }, TimeEntryTagRow>(
        "SELECT * FROM time_entry_tags WHERE time_entry_id = @timeEntryId",
      )
      .all({ timeEntryId })
      .map((row) => row.tag_id);
  }

  private tagIdsForMany(timeEntryIds: string[]): Map<string, string[]> {
    const byEntry = new Map<string, string[]>();
    if (timeEntryIds.length === 0) return byEntry;
    const placeholders = timeEntryIds.map((_, i) => `@id${i}`).join(", ");
    const params = Object.fromEntries(timeEntryIds.map((id, i) => [`id${i}`, id]));
    const rows = this.db
      .prepare<Record<string, unknown>, TimeEntryTagRow>(
        `SELECT * FROM time_entry_tags WHERE time_entry_id IN (${placeholders})`,
      )
      .all(params);
    for (const row of rows) {
      const list = byEntry.get(row.time_entry_id) ?? [];
      list.push(row.tag_id);
      byEntry.set(row.time_entry_id, list);
    }
    return byEntry;
  }

  /** Builds the WHERE clause + bound params shared by every `findByFilter` query. */
  private static buildWhere(filter: TimeEntryFilter): {
    where: string;
    params: Record<string, unknown>;
  } {
    const clauses = ["te.workspace_id = @workspaceId"];
    const params: Record<string, unknown> = { workspaceId: filter.workspaceId };

    if (filter.range) {
      clauses.push("te.start_ts >= @rangeStart AND te.start_ts < @rangeEnd");
      params.rangeStart = filter.range.start.toISOString();
      params.rangeEnd = filter.range.end.toISOString();
    }
    if (filter.projectId) {
      clauses.push("te.project_id = @projectId");
      params.projectId = filter.projectId;
    }
    if (filter.tagId) {
      clauses.push("tet.tag_id = @tagId");
      params.tagId = filter.tagId;
    }
    if (filter.billable !== undefined) {
      clauses.push("te.billable = @billable");
      params.billable = filter.billable ? 1 : 0;
    }

    return { where: clauses.join(" AND "), params };
  }

  private static toRow(entry: TimeEntry): Record<string, unknown> {
    return {
      id: entry.id,
      workspaceId: entry.workspaceId,
      projectId: entry.projectId,
      description: entry.description,
      startTs: entry.startTs.toISOString(),
      endTs: entry.endTs ? entry.endTs.toISOString() : null,
      billable: entry.billable ? 1 : 0,
      gitRepo: entry.git?.repo ?? null,
      gitCommit: entry.git?.commit ?? null,
      gitBranch: entry.git?.branch ?? null,
      source: entry.source,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }

  private static toEntity(row: TimeEntryRow, tagIds: string[]): TimeEntry {
    const git: GitMetadata | null =
      row.git_repo && row.git_commit && row.git_branch
        ? { repo: row.git_repo, commit: row.git_commit, branch: row.git_branch }
        : null;
    return TimeEntry.reconstruct({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      description: row.description,
      startTs: new Date(row.start_ts),
      endTs: row.end_ts ? new Date(row.end_ts) : null,
      billable: row.billable === 1,
      git,
      source: row.source as TimeEntrySource,
      tagIds,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    });
  }
}
