import type { ActiveWorkspaceStore } from "../../../src/domain/ports/ActiveWorkspaceStore.js";

export class InMemoryActiveWorkspaceStore implements ActiveWorkspaceStore {
  private activeId: string | null = null;

  async getActiveWorkspaceId(): Promise<string | null> {
    return this.activeId;
  }

  async setActiveWorkspaceId(id: string): Promise<void> {
    this.activeId = id;
  }

  async clearActiveWorkspaceId(): Promise<void> {
    this.activeId = null;
  }
}
