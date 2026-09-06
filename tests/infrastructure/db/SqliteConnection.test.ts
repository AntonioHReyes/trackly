import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";

describe("SqliteConnection", () => {
  let connection: SqliteConnection | undefined;

  afterEach(() => {
    connection?.close();
  });

  it("creates the expected tables on first open", () => {
    connection = new SqliteConnection(":memory:");
    const tables = connection.db
      .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
      .sort();
    expect(tables).toEqual(
      [
        "projects",
        "schema_migrations",
        "tags",
        "time_entries",
        "time_entry_tags",
        "workspaces",
      ].sort(),
    );
  });

  it("is idempotent when reopened against the same file", () => {
    const dir = mkdtempSync(join(tmpdir(), "trackly-db-test-"));
    const dbPath = join(dir, "trackly.db");
    try {
      connection = new SqliteConnection(dbPath);
      connection.close();
      expect(() => {
        connection = new SqliteConnection(dbPath);
      }).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enables foreign key enforcement", () => {
    connection = new SqliteConnection(":memory:");
    const result = connection.db.pragma("foreign_keys", { simple: true });
    expect(result).toBe(1);
  });

  it("creates the parent directory when it doesn't exist yet (e.g. a fresh install)", () => {
    const dir = mkdtempSync(join(tmpdir(), "trackly-db-test-"));
    const dbPath = join(dir, "nested", "config", "trackly.db");
    try {
      expect(() => {
        connection = new SqliteConnection(dbPath);
      }).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
