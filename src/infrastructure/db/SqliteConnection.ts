import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS } from "./migrations.js";

interface SchemaVersionRow {
  version: number;
}

/**
 * Opens the SQLite file, applies pragmas, and brings the schema up to date.
 * `DELETE` journal mode (not WAL) is deliberate — see SPEC.md's
 * "Storage / sync" section: fewer auxiliary files for a cloud-synced DB path
 * to get confused by.
 */
export class SqliteConnection {
  readonly db: Database.Database;

  constructor(path: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma("journal_mode = DELETE");
    this.db.pragma("foreign_keys = ON");
    this.runMigrations();
  }

  close(): void {
    this.db.close();
  }

  private runMigrations(): void {
    this.db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)`);
    const applied = new Set(
      this.db
        .prepare<[], SchemaVersionRow>("SELECT version FROM schema_migrations")
        .all()
        .map((row) => row.version),
    );
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;
      this.db.transaction(() => {
        migration.up(this.db);
        this.db
          .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
          .run(migration.version);
      })();
    }
  }
}
