import type { Workspace } from "../entities/Workspace.js";

/**
 * Port for workspace persistence. Implemented by infrastructure (SQLite);
 * application services depend on this interface only, never on the concrete
 * implementation (Dependency Inversion).
 */
export interface WorkspaceRepository {
  save(workspace: Workspace): Promise<void>;
  findById(id: string): Promise<Workspace | null>;
  findBySlug(slug: string): Promise<Workspace | null>;
  findAll(): Promise<Workspace[]>;
  delete(id: string): Promise<void>;
}
