import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonStore } from "../../../src/infrastructure/config/JsonStore.js";

interface Shape {
  name?: string;
  count?: number;
}

describe("JsonStore", () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function storeAt(name: string, defaultValue: Shape = {}): JsonStore<Shape> {
    dir = mkdtempSync(join(tmpdir(), "trackly-json-test-"));
    return new JsonStore(join(dir, name), defaultValue);
  }

  it("returns the default value for a missing file", () => {
    expect(storeAt("missing.json").read()).toEqual({});
  });

  it("round-trips a written value", () => {
    const store = storeAt("state.json");
    store.write({ name: "acme", count: 3 });
    expect(store.read()).toEqual({ name: "acme", count: 3 });
  });

  it("update() shallow-merges onto the existing value", () => {
    const store = storeAt("state.json");
    store.write({ name: "acme" });
    store.update({ count: 3 });
    expect(store.read()).toEqual({ name: "acme", count: 3 });
  });

  it("degrades to the default value when the file is corrupt", () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-json-test-"));
    const path = join(dir, "corrupt.json");
    writeFileSync(path, "{not json", "utf8");
    const store = new JsonStore<Shape>(path, { name: "fallback" });
    expect(store.read()).toEqual({ name: "fallback" });
  });
});
