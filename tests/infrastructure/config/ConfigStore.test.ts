import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ConfigStore } from "../../../src/infrastructure/config/ConfigStore.js";

describe("ConfigStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function newStore(): ConfigStore {
    dir = mkdtempSync(join(tmpdir(), "trackly-config-test-"));
    return new ConfigStore(join(dir, "config.toml"));
  }

  it("defaults week-start to monday, db-path to undefined and rounding to off", () => {
    const store = newStore();
    const values = store.read();
    expect(values.dbPath).toBeUndefined();
    expect(values.weekStart).toBe("monday");
    expect(values.rounding.isEnabled).toBe(false);
  });

  it("persists a rounding mode and increment", () => {
    const store = newStore();
    store.setRoundingMode("up");
    store.setRoundingMinutes(30);
    expect(store.read().rounding.describe()).toBe("up 30 min");
  });

  it("falls back to defaults when the stored rounding is unusable", () => {
    const store = newStore();
    store.setRoundingMode("nearest");
    expect(store.read().rounding.minutes).toBe(15);
  });

  it("persists a custom db-path", () => {
    const store = newStore();
    store.setDbPath("/mnt/mega/trackly.db");
    expect(store.read().dbPath).toBe("/mnt/mega/trackly.db");
  });

  it("persists week-start", () => {
    const store = newStore();
    store.setWeekStart("sunday");
    expect(store.read().weekStart).toBe("sunday");
  });
});
