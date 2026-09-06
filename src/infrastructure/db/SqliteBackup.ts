import { copyFile, readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import type { SqliteConnection } from "./SqliteConnection.js";

// Dependency order matters for the SQL dump: parents before children, so
// replaying it against an empty db never violates a foreign key.
const DUMP_TABLES = [
  "schema_migrations",
  "workspaces",
  "projects",
  "tags",
  "time_entries",
  "time_entry_tags",
] as const;

interface TableSqlRow {
  sql: string;
}

/**
 * Backup/restore for the sqlite db (`tck backup`/`tck restore`, see SPEC.md's
 * "Storage / sync" section). Two formats, both taken on every backup:
 *  - binary: a byte-for-byte copy via better-sqlite3's native `.backup()`.
 *  - plain-text SQL dump: diffable and recoverable even if the sqlite file
 *    format itself ever gets corrupted by an interrupted cloud sync.
 */
export class SqliteBackup {
  constructor(private readonly connection: SqliteConnection) {}

  async backupBinary(outPath: string): Promise<void> {
    await mkdir(dirname(outPath), { recursive: true });
    await this.connection.db.backup(outPath);
  }

  async dumpSql(outPath: string): Promise<void> {
    await mkdir(dirname(outPath), { recursive: true });
    const lines: string[] = ["PRAGMA foreign_keys=OFF;", "BEGIN TRANSACTION;"];

    for (const table of DUMP_TABLES) {
      const createRow = this.connection.db
        .prepare<[string], TableSqlRow>(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(table);
      if (!createRow) continue;

      lines.push(`DROP TABLE IF EXISTS ${table};`, `${createRow.sql};`);
      const rows = this.connection.db.prepare(`SELECT * FROM ${table}`).all() as Array<
        Record<string, unknown>
      >;
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((c) => SqliteBackup.sqlLiteral(row[c]));
        lines.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${values.join(", ")});`);
      }
    }

    lines.push("COMMIT;");
    await writeFile(outPath, lines.join("\n") + "\n", "utf8");
  }

  private static sqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  /**
   * Overwrites the live db file with a binary backup. Static because it
   * operates on a closed connection — the caller must close its
   * `SqliteConnection` first, since the file is locked while open.
   */
  static async restoreBinary(backupPath: string, dbPath: string): Promise<void> {
    await mkdir(dirname(dbPath), { recursive: true });
    await copyFile(backupPath, dbPath);
  }

  /** Rebuilds the db file by replaying a plain-text SQL dump. Same closed-connection caveat. */
  static async restoreSql(dumpPath: string, dbPath: string): Promise<void> {
    await mkdir(dirname(dbPath), { recursive: true });
    const sql = await readFile(dumpPath, "utf8");
    const db = new Database(dbPath);
    try {
      db.exec(sql);
    } finally {
      db.close();
    }
  }
}
