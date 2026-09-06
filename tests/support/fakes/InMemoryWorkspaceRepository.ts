import type { Workspace } from "../../../src/domain/entities/Workspace.js";
import type { WorkspaceRepository } from "../../../src/domain/repositories/WorkspaceRepository.js";

/** In-memory `WorkspaceRepository` fake for fast application-layer unit tests. */
export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  private readonly byId = new Map<string, Workspace>();

  async save(workspace: Workspace): Promise<void> {
    this.byId.set(workspace.id, workspace);
  }

  async findById(id: string): Promise<Workspace | null> {
    return this.byId.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    return [...this.byId.values()].find((w) => w.slug === slug) ?? null;
  }

  async findAll(): Promise<Workspace[]> {
    return [...this.byId.values()];
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}
