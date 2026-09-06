import { Project } from "../../domain/entities/Project.js";
import type { ProjectRepository } from "../../domain/repositories/ProjectRepository.js";
import { NotFoundError } from "../../domain/errors/DomainError.js";

export class ProjectService {
  constructor(private readonly projects: ProjectRepository) {}

  async create(params: {
    workspaceId: string;
    name: string;
    client?: string | null;
    color?: string | null;
    hourlyRate?: number | null;
  }): Promise<Project> {
    const project = Project.create(params);
    await this.projects.save(project);
    return project;
  }

  async list(workspaceId: string, includeArchived = false): Promise<Project[]> {
    return this.projects.findByWorkspace(workspaceId, { includeArchived });
  }

  async getById(id: string): Promise<Project> {
    const project = await this.projects.findById(id);
    if (!project) {
      throw new NotFoundError("Project", id);
    }
    return project;
  }

  async edit(
    id: string,
    updates: {
      name?: string;
      client?: string | null;
      color?: string | null;
      hourlyRate?: number | null;
    },
  ): Promise<Project> {
    const project = await this.getById(id);
    const updated = project.withUpdates(updates);
    await this.projects.save(updated);
    return updated;
  }

  async archive(id: string): Promise<Project> {
    const project = await this.getById(id);
    const archived = project.archive();
    await this.projects.save(archived);
    return archived;
  }

  async remove(id: string): Promise<void> {
    await this.getById(id);
    await this.projects.delete(id);
  }
}
