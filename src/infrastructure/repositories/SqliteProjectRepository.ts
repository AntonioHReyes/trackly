import type Database from "better-sqlite3";
import { Project } from "../../domain/entities/Project.js";
import type { ProjectRepository } from "../../domain/repositories/ProjectRepository.js";

interface ProjectRow {
  id: string;
  workspace_id: string;
  name: string;
  client: string | null;
  color: string | null;
  hourly_rate: number | null;
  archived: number;
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database.Database) {}

  async save(project: Project): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO projects (id, workspace_id, name, client, color, hourly_rate, archived)
         VALUES (@id, @workspaceId, @name, @client, @color, @hourlyRate, @archived)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           client = excluded.client,
           color = excluded.color,
           hourly_rate = excluded.hourly_rate,
           archived = excluded.archived`,
      )
      .run({
        id: project.id,
        workspaceId: project.workspaceId,
        name: project.name,
        client: project.client,
        color: project.color,
        hourlyRate: project.hourlyRate,
        archived: project.archived ? 1 : 0,
      });
  }

  async findById(id: string): Promise<Project | null> {
    const row = this.db
      .prepare<{ id: string }, ProjectRow>("SELECT * FROM projects WHERE id = @id")
      .get({ id });
    return row ? SqliteProjectRepository.toEntity(row) : null;
  }

  async findByWorkspace(
    workspaceId: string,
    options?: { includeArchived?: boolean },
  ): Promise<Project[]> {
    const includeArchived = options?.includeArchived ?? false;
    const rows = this.db
      .prepare<{ workspaceId: string }, ProjectRow>(
        includeArchived
          ? "SELECT * FROM projects WHERE workspace_id = @workspaceId ORDER BY name ASC"
          : "SELECT * FROM projects WHERE workspace_id = @workspaceId AND archived = 0 ORDER BY name ASC",
      )
      .all({ workspaceId });
    return rows.map(SqliteProjectRepository.toEntity);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM projects WHERE id = @id").run({ id });
  }

  private static toEntity(row: ProjectRow): Project {
    return Project.reconstruct({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      client: row.client,
      color: row.color,
      hourlyRate: row.hourly_rate,
      archived: row.archived === 1,
    });
  }
}
