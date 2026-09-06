import type { Command } from "commander";
import type { Container } from "../container.js";
import { SqliteBackup } from "../../infrastructure/db/SqliteBackup.js";
import { defaultDbPath } from "../../infrastructure/config/paths.js";
import * as ui from "../ui/index.js";

/**
 * `tck restore <path>` — restores from either backup format produced by
 * `tck backup` (`.sql` dump or binary `.db` copy). Closes the live
 * connection first since the db file is locked while open; the process
 * exits right after, so there's no need to reopen it.
 */
export function registerRestoreCommands(program: Command, container: Container): void {
  program
    .command("restore <path>")
    .description("Restore the database from a backup (.db binary or .sql dump)")
    .action(async (path: string) => {
      const dbPath = container.configStore.read().dbPath ?? defaultDbPath();
      container.close();
      if (path.endsWith(".sql")) {
        await SqliteBackup.restoreSql(path, dbPath);
      } else {
        await SqliteBackup.restoreBinary(path, dbPath);
      }
      ui.success(`Database restored from ${ui.code(path)}`);
      ui.hint(`Database: ${dbPath}`);
    });
}
