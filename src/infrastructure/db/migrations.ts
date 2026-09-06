import type Database from "better-sqlite3";

export interface Migration {
  version: number;
  up: (db: Database.Database) => void;
}

/**
 * Ordered, additive schema history. Each migration runs once (tracked in
 * `schema_migrations`) inside a transaction — see `SqliteConnection`.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE workspaces (
          id                  TEXT PRIMARY KEY,
          slug                TEXT NOT NULL UNIQUE,
          name                TEXT NOT NULL,
          default_hourly_rate REAL,
          currency            TEXT NOT NULL,
          created_at          TEXT NOT NULL
        );

        CREATE TABLE projects (
          id            TEXT PRIMARY KEY,
          workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name          TEXT NOT NULL,
          client        TEXT,
          color         TEXT,
          hourly_rate   REAL,
          archived      INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX idx_projects_workspace ON projects(workspace_id);

        CREATE TABLE tags (
          id            TEXT PRIMARY KEY,
          workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name          TEXT NOT NULL
        );
        CREATE INDEX idx_tags_workspace ON tags(workspace_id);

        CREATE TABLE time_entries (
          id            TEXT PRIMARY KEY,
          workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
          description   TEXT NOT NULL,
          start_ts      TEXT NOT NULL,
          end_ts        TEXT,
          billable      INTEGER NOT NULL DEFAULT 1,
          git_repo      TEXT,
          git_commit    TEXT,
          git_branch    TEXT,
          source        TEXT NOT NULL,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );
        CREATE INDEX idx_time_entries_workspace_start ON time_entries(workspace_id, start_ts);
        CREATE INDEX idx_time_entries_project ON time_entries(project_id);

        CREATE TABLE time_entry_tags (
          time_entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
          tag_id        TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (time_entry_id, tag_id)
        );
      `);
    },
  },
];
