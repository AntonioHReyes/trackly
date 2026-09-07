import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { MIGRATIONS } from "../../../src/infrastructure/db/migrations.js";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";

/**
 * Simulates an existing install (pre-rate-snapshot) reopening trackly after
 * the upgrade: migration 2 must backfill `rate` from what resolves *today*,
 * so a rate change afterwards doesn't retroactively reprice old entries.
 */
describe("migration 2 (time_entries.rate backfill)", () => {
  let dir: string;
  let dbPath: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("backfills existing rows from the project's or workspace's current rate", () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-migration-test-"));
    dbPath = join(dir, "trackly.db");

    // Build a v1-only database directly, as if created before rate
    // snapshotting existed.
    const seed = new Database(dbPath);
    seed.pragma("foreign_keys = ON");
    seed.exec(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY)`);
    MIGRATIONS[0]!.up(seed);
    seed.prepare("INSERT INTO schema_migrations (version) VALUES (1)").run();

    seed
      .prepare(
        `INSERT INTO workspaces (id, slug, name, default_hourly_rate, currency, created_at)
         VALUES ('ws-1', 'acme', 'Acme', 10, 'USD', '2026-01-01T00:00:00.000Z')`,
      )
      .run();
    seed
      .prepare(
        `INSERT INTO projects (id, workspace_id, name, hourly_rate, archived)
         VALUES ('proj-1', 'ws-1', 'Website', 50, 0)`,
      )
      .run();
    // Entry priced via the project's own rate.
    seed
      .prepare(
        `INSERT INTO time_entries
           (id, workspace_id, project_id, description, start_ts, end_ts, billable, source, created_at, updated_at)
         VALUES
           ('e-project', 'ws-1', 'proj-1', 'Via project rate', '2026-01-01T09:00:00.000Z',
            '2026-01-01T10:00:00.000Z', 1, 'manual', '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')`,
      )
      .run();
    // Entry priced via the workspace default (no project).
    seed
      .prepare(
        `INSERT INTO time_entries
           (id, workspace_id, project_id, description, start_ts, end_ts, billable, source, created_at, updated_at)
         VALUES
           ('e-default', 'ws-1', NULL, 'Via workspace default', '2026-01-01T09:00:00.000Z',
            '2026-01-01T10:00:00.000Z', 1, 'manual', '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z')`,
      )
      .run();
    seed.close();

    // Reopening through the real connection applies migration 2 and its backfill.
    const connection = new SqliteConnection(dbPath);
    try {
      const rows = connection.db
        .prepare<[], { id: string; rate: number | null }>(
          "SELECT id, rate FROM time_entries ORDER BY id",
        )
        .all();
      expect(rows).toEqual([
        { id: "e-default", rate: 10 },
        { id: "e-project", rate: 50 },
      ]);

      // Raising the project's rate afterwards must not touch entries already
      // backfilled — that's the whole point of freezing the rate on them.
      connection.db.prepare("UPDATE projects SET hourly_rate = 500 WHERE id = 'proj-1'").run();
      const stillFrozen = connection.db
        .prepare<[string], { rate: number | null }>("SELECT rate FROM time_entries WHERE id = ?")
        .get("e-project");
      expect(stillFrozen?.rate).toBe(50);
    } finally {
      connection.close();
    }
  });
});
