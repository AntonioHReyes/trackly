import type Database from "better-sqlite3";
import { Tag } from "../../domain/entities/Tag.js";
import type { TagRepository } from "../../domain/repositories/TagRepository.js";

interface TagRow {
  id: string;
  workspace_id: string;
  name: string;
}

export class SqliteTagRepository implements TagRepository {
  constructor(private readonly db: Database.Database) {}

  async save(tag: Tag): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tags (id, workspace_id, name)
         VALUES (@id, @workspaceId, @name)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
      )
      .run({ id: tag.id, workspaceId: tag.workspaceId, name: tag.name });
  }

  async findById(id: string): Promise<Tag | null> {
    const row = this.db
      .prepare<{ id: string }, TagRow>("SELECT * FROM tags WHERE id = @id")
      .get({ id });
    return row ? SqliteTagRepository.toEntity(row) : null;
  }

  async findByWorkspace(workspaceId: string): Promise<Tag[]> {
    const rows = this.db
      .prepare<{ workspaceId: string }, TagRow>(
        "SELECT * FROM tags WHERE workspace_id = @workspaceId ORDER BY name ASC",
      )
      .all({ workspaceId });
    return rows.map(SqliteTagRepository.toEntity);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM tags WHERE id = @id").run({ id });
  }

  private static toEntity(row: TagRow): Tag {
    return Tag.reconstruct({ id: row.id, workspaceId: row.workspace_id, name: row.name });
  }
}
