import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ReportPresetStore } from "../../../src/infrastructure/config/ReportPresetStore.js";

describe("ReportPresetStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function newStore(): ReportPresetStore {
    dir = mkdtempSync(join(tmpdir(), "trackly-report-preset-test-"));
    return new ReportPresetStore(join(dir, "report-presets.json"));
  }

  it("lists nothing when no presets have been saved", () => {
    expect(newStore().list()).toEqual({});
  });

  it("saves and retrieves a preset by name", () => {
    const store = newStore();
    store.save("last-month-rounded", { lastMonth: true, rounding: "up", roundingMinutes: "15" });
    expect(store.get("last-month-rounded")).toEqual({
      lastMonth: true,
      rounding: "up",
      roundingMinutes: "15",
    });
  });

  it("returns undefined for an unknown preset", () => {
    expect(newStore().get("missing")).toBeUndefined();
  });

  it("saving under an existing name overwrites it", () => {
    const store = newStore();
    store.save("mine", { thisWeek: true });
    store.save("mine", { thisMonth: true });
    expect(store.get("mine")).toEqual({ thisMonth: true });
  });

  it("lists multiple presets independently", () => {
    const store = newStore();
    store.save("a", { thisWeek: true });
    store.save("b", { lastWeek: true });
    expect(store.list()).toEqual({ a: { thisWeek: true }, b: { lastWeek: true } });
  });

  it("removes a saved preset", () => {
    const store = newStore();
    store.save("mine", { thisWeek: true });
    store.remove("mine");
    expect(store.get("mine")).toBeUndefined();
    expect(store.list()).toEqual({});
  });

  it("throws when removing an unknown preset", () => {
    const store = newStore();
    expect(() => store.remove("missing")).toThrow(/no report preset named/i);
  });
});
