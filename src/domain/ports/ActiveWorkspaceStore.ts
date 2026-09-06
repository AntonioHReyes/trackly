/**
 * Port for the "current context" concept (like `kubectl`'s current
 * context) — which workspace commands apply to when `-w/--workspace` isn't
 * given. Not entity persistence, so it lives beside the repositories
 * rather than in them. Implemented by `StateStore` (a small state file),
 * consumed by `WorkspaceService`.
 */
export interface ActiveWorkspaceStore {
  getActiveWorkspaceId(): Promise<string | null>;
  setActiveWorkspaceId(id: string): Promise<void>;
  /** Forgets the current context (used when the active workspace is deleted). */
  clearActiveWorkspaceId(): Promise<void>;
}
