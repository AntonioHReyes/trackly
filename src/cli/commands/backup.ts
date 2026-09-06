import { join } from "node:path";
import type { Command } from "commander";
import type { Container } from "../container.js";
import { defaultBackupDir } from "../../infrastructure/config/paths.js";
import * as ui from "../ui/index.js";

/** `tck backup` — writes both a binary copy and a plain-text SQL dump (see SPEC.md). */
export function registerBackupCommands(program: Command, container: Container): void {
  program
    .command("backup")
    .description("Back up the database (binary .db copy + plain-text SQL dump)")
    .option("--dir <path>", "backup directory", defaultBackupDir())
    .action(async (options: { dir: string }) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const binaryPath = join(options.dir, `trackly-${timestamp}.db`);
      const sqlPath = join(options.dir, `trackly-${timestamp}.sql`);
      await container.backup.backupBinary(binaryPath);
      await container.backup.dumpSql(sqlPath);
      ui.success("Database backed up");
      ui.print(
        ui.renderDetails([
          ["Binary", ui.code(binaryPath)],
          ["SQL dump", ui.code(sqlPath)],
        ]),
      );
      ui.hint(`tck restore ${binaryPath}`);
    });
}
