import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteConnection } from "../../../src/infrastructure/db/SqliteConnection.js";
import { SqliteBackup } from "../../../src/infrastructure/db/SqliteBackup.js";
import { SqliteWorkspaceRepository } from "../../../src/infrastructure/repositories/SqliteWorkspaceRepository.js";
import { Workspace } from "../../../src/domain/entities/Workspace.js";

describe("SqliteBackup", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips data through a binary backup and restore", async () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-backup-test-"));
    const dbPath = join(dir, "trackly.db");
    const backupPath = join(dir, "backups", "trackly.db");

    let connection = new SqliteConnection(dbPath);
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await new SqliteWorkspaceRepository(connection.db).save(workspace);
    await new SqliteBackup(connection).backupBinary(backupPath);
    connection.close();

    expect(existsSync(backupPath)).toBe(true);

    const restoredPath = join(dir, "restored.db");
    await SqliteBackup.restoreBinary(backupPath, restoredPath);

    connection = new SqliteConnection(restoredPath);
    const restored = await new SqliteWorkspaceRepository(connection.db).findBySlug("acme");
    connection.close();
    expect(restored?.name).toBe("Acme");
  });

  it("round-trips data through a plain-text SQL dump and restore", async () => {
    dir = mkdtempSync(join(tmpdir(), "trackly-backup-test-"));
    const dbPath = join(dir, "trackly.db");
    const dumpPath = join(dir, "backups", "trackly.sql");

    let connection = new SqliteConnection(dbPath);
    const workspace = Workspace.create({ slug: "acme", name: "Acme", currency: "USD" });
    await new SqliteWorkspaceRepository(connection.db).save(workspace);
    await new SqliteBackup(connection).dumpSql(dumpPath);
    connection.close();

    expect(existsSync(dumpPath)).toBe(true);

    const restoredPath = join(dir, "restored.db");
    await SqliteBackup.restoreSql(dumpPath, restoredPath);

    connection = new SqliteConnection(restoredPath);
    const restored = await new SqliteWorkspaceRepository(connection.db).findBySlug("acme");
    connection.close();
    expect(restored?.name).toBe("Acme");
  });
});
