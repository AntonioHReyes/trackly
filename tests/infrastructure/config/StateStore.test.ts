import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StateStore } from "../../../src/infrastructure/config/StateStore.js";

describe("StateStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function newStore(): StateStore {
    dir = mkdtempSync(join(tmpdir(), "trackly-state-test-"));
    return new StateStore(join(dir, "state.toml"));
  }

  it("returns null when no workspace is active", async () => {
    expect(await newStore().getActiveWorkspaceId()).toBeNull();
  });

  it("persists the active workspace id", async () => {
    const store = newStore();
    await store.setActiveWorkspaceId("ws-1");
    expect(await store.getActiveWorkspaceId()).toBe("ws-1");
  });
});
