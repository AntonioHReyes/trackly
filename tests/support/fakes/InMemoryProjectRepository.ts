import type { Project } from "../../../src/domain/entities/Project.js";
import type { ProjectRepository } from "../../../src/domain/repositories/ProjectRepository.js";

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly byId = new Map<string, Project>();

  async save(project: Project): Promise<void> {
    this.byId.set(project.id, project);
  }

  async findById(id: string): Promise<Project | null> {
    return this.byId.get(id) ?? null;
  }

  async findByWorkspace(
    workspaceId: string,
    options?: { includeArchived?: boolean },
  ): Promise<Project[]> {
    const includeArchived = options?.includeArchived ?? false;
    return [...this.byId.values()].filter(
      (p) => p.workspaceId === workspaceId && (includeArchived || !p.archived),
    );
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}
