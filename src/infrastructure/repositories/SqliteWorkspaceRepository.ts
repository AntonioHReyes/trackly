import type Database from "better-sqlite3";
import { Workspace } from "../../domain/entities/Workspace.js";
import type { WorkspaceRepository } from "../../domain/repositories/WorkspaceRepository.js";
import { ConflictError } from "../../domain/errors/DomainError.js";

interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  default_hourly_rate: number | null;
  currency: string;
  created_at: string;
}

/** `WorkspaceRepository` backed by `better-sqlite3`. Purely synchronous
 * under the hood; methods stay `async` to match the domain port. */
export class SqliteWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database.Database) {}

  async save(workspace: Workspace): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT INTO workspaces (id, slug, name, default_hourly_rate, currency, created_at)
           VALUES (@id, @slug, @name, @defaultHourlyRate, @currency, @createdAt)
           ON CONFLICT(id) DO UPDATE SET
             slug = excluded.slug,
             name = excluded.name,
             default_hourly_rate = excluded.default_hourly_rate,
             currency = excluded.currency`,
        )
        .run({
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          defaultHourlyRate: workspace.defaultHourlyRate,
          currency: workspace.currency,
          createdAt: workspace.createdAt.toISOString(),
        });
    } catch (error) {
      throw SqliteWorkspaceRepository.translateError(error, workspace.slug);
    }
  }

  async findById(id: string): Promise<Workspace | null> {
    const row = this.db
      .prepare<{ id: string }, WorkspaceRow>("SELECT * FROM workspaces WHERE id = @id")
      .get({ id });
    return row ? SqliteWorkspaceRepository.toEntity(row) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const row = this.db
      .prepare<{ slug: string }, WorkspaceRow>("SELECT * FROM workspaces WHERE slug = @slug")
      .get({ slug });
    return row ? SqliteWorkspaceRepository.toEntity(row) : null;
  }

  async findAll(): Promise<Workspace[]> {
    const rows = this.db
      .prepare<[], WorkspaceRow>("SELECT * FROM workspaces ORDER BY created_at ASC")
      .all();
    return rows.map(SqliteWorkspaceRepository.toEntity);
  }

  async delete(id: string): Promise<void> {
    this.db.prepare("DELETE FROM workspaces WHERE id = @id").run({ id });
  }

  private static toEntity(row: WorkspaceRow): Workspace {
    return Workspace.reconstruct({
      id: row.id,
      slug: row.slug,
      name: row.name,
      defaultHourlyRate: row.default_hourly_rate,
      currency: row.currency,
      createdAt: new Date(row.created_at),
    });
  }

  private static translateError(error: unknown, slug: string): unknown {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: workspaces.slug")
    ) {
      return new ConflictError(`Workspace slug already exists: ${slug}`);
    }
    return error;
  }
}
