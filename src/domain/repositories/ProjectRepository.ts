import type { Project } from "../entities/Project.js";

export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
  findByWorkspace(workspaceId: string, options?: { includeArchived?: boolean }): Promise<Project[]>;
  delete(id: string): Promise<void>;
}
