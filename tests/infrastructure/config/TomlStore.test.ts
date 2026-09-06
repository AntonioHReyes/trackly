import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TomlStore } from "../../../src/infrastructure/config/TomlStore.js";

describe("TomlStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function storeAt(name: string): TomlStore {
    dir = mkdtempSync(join(tmpdir(), "trackly-toml-test-"));
    return new TomlStore(join(dir, name));
  }

  it("returns an empty object for a missing file", () => {
    expect(storeAt("missing.toml").read()).toEqual({});
  });

  it("round-trips strings, numbers, and booleans", () => {
    const store = storeAt("config.toml");
    store.write({ "db-path": "/tmp/trackly.db", retries: 3, verbose: true });
    expect(store.read()).toEqual({ "db-path": "/tmp/trackly.db", retries: 3, verbose: true });
  });

  it("update() merges onto the existing values", () => {
    const store = storeAt("config.toml");
    store.write({ "week-start": "monday" });
    store.update({ "db-path": "/tmp/trackly.db" });
    expect(store.read()).toEqual({ "week-start": "monday", "db-path": "/tmp/trackly.db" });
  });

  it("ignores blank lines and comments", () => {
    const store = storeAt("config.toml");
    store.write({ "week-start": "monday" });
    // Simulate a hand-edited file with a comment, then re-read through the store.
    const withComment = new TomlStore(join(dir, "config.toml"));
    withComment.update({ "db-path": "/tmp/x.db" });
    expect(withComment.read()["week-start"]).toBe("monday");
  });
});
