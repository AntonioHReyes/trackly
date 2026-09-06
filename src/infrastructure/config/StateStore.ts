import { TomlStore } from "./TomlStore.js";
import { stateFilePath } from "./paths.js";
import type { ActiveWorkspaceStore } from "../../domain/ports/ActiveWorkspaceStore.js";

/** File-backed `ActiveWorkspaceStore` — the "current context" (`tck workspace switch`). */
export class StateStore implements ActiveWorkspaceStore {
  private readonly toml: TomlStore;

  constructor(filePath: string = stateFilePath()) {
    this.toml = new TomlStore(filePath);
  }

  async getActiveWorkspaceId(): Promise<string | null> {
    const id = this.toml.read()["active-workspace-id"];
    return typeof id === "string" ? id : null;
  }

  async setActiveWorkspaceId(id: string): Promise<void> {
    this.toml.update({ "active-workspace-id": id });
  }

  async clearActiveWorkspaceId(): Promise<void> {
    this.toml.remove("active-workspace-id");
  }
}
