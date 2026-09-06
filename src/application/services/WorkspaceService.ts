import { Workspace } from "../../domain/entities/Workspace.js";
import type { WorkspaceRepository } from "../../domain/repositories/WorkspaceRepository.js";
import type { ActiveWorkspaceStore } from "../../domain/ports/ActiveWorkspaceStore.js";
import { ConflictError, NotFoundError } from "../../domain/errors/DomainError.js";

/**
 * Workspace CRUD plus "current context" resolution — every other service
 * that needs a `workspaceId` gets it by calling `resolveActive` first
 * (mirrors `kubectl`'s current-context pattern, see SPEC.md).
 */
export class WorkspaceService {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly activeWorkspaceStore: ActiveWorkspaceStore,
  ) {}

  async create(params: {
    slug: string;
    name: string;
    defaultHourlyRate?: number | null;
    currency: string;
  }): Promise<Workspace> {
    const existing = await this.workspaces.findBySlug(params.slug);
    if (existing) {
      throw new ConflictError(`Workspace slug already exists: ${params.slug}`);
    }
    const workspace = Workspace.create(params);
    await this.workspaces.save(workspace);
    return workspace;
  }

  async list(): Promise<Workspace[]> {
    return this.workspaces.findAll();
  }

  async getBySlug(slug: string): Promise<Workspace> {
    const workspace = await this.workspaces.findBySlug(slug);
    if (!workspace) {
      throw new NotFoundError("Workspace", slug);
    }
    return workspace;
  }

  /** Deletes the workspace; if it was the current context, that context is cleared too. */
  async remove(slug: string): Promise<void> {
    const workspace = await this.getBySlug(slug);
    await this.workspaces.delete(workspace.id);
    if ((await this.activeWorkspaceStore.getActiveWorkspaceId()) === workspace.id) {
      await this.activeWorkspaceStore.clearActiveWorkspaceId();
    }
  }

  async setDefaultRate(slug: string, amount: number): Promise<Workspace> {
    const workspace = await this.getBySlug(slug);
    const updated = workspace.withDefaultHourlyRate(amount);
    await this.workspaces.save(updated);
    return updated;
  }

  async setCurrency(slug: string, currency: string): Promise<Workspace> {
    const workspace = await this.getBySlug(slug);
    const updated = workspace.withCurrency(currency);
    await this.workspaces.save(updated);
    return updated;
  }

  async switchActive(slug: string): Promise<Workspace> {
    const workspace = await this.getBySlug(slug);
    await this.activeWorkspaceStore.setActiveWorkspaceId(workspace.id);
    return workspace;
  }

  /**
   * Resolves which workspace a command should operate on: an explicit
   * `-w/--workspace` slug wins, otherwise falls back to the active context.
   */
  async resolveActive(overrideSlug?: string): Promise<Workspace> {
    if (overrideSlug) {
      return this.getBySlug(overrideSlug);
    }
    const activeId = await this.activeWorkspaceStore.getActiveWorkspaceId();
    if (!activeId) {
      throw new NotFoundError(
        "Active workspace",
        "none set — run `tck workspace switch <slug>` or pass -w <slug>",
      );
    }
    const workspace = await this.workspaces.findById(activeId);
    if (!workspace) {
      throw new NotFoundError("Workspace", activeId);
    }
    return workspace;
  }
}
