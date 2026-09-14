import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import type { Container } from "./container.js";
import { registerWorkspaceCommands } from "./commands/workspace.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerTagCommands } from "./commands/tag.js";
import { registerEntryCommands } from "./commands/entry.js";
import { registerReportCommands } from "./commands/report.js";
import { registerInvoiceCommands } from "./commands/invoice.js";
import { registerExportCommands } from "./commands/export.js";
import { registerEarningsCommands } from "./commands/earnings.js";
import { registerRateCommands } from "./commands/rate.js";
import { registerConfigCommands } from "./commands/config.js";
import { registerBackupCommands } from "./commands/backup.js";
import { registerRestoreCommands } from "./commands/restore.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerGitHookCommands } from "./commands/gitHook.js";

// Read the version from package.json instead of hardcoding it, so `tck
// --version` never drifts from what was actually published.
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, "../../package.json"), "utf-8"),
) as { version: string };

export const CLI_VERSION = version;

/**
 * Wires every command onto a fresh `Command`. It lives apart from
 * `index.ts` (which runs the CLI on import) so the docs generator can read
 * the exact command tree users get without executing anything — an
 * undocumented flag becomes impossible rather than merely unlikely.
 */
export function buildProgram(container: Container): Command {
  const program = new Command();

  program
    .name("tck")
    .description("Time-tracking CLI")
    .version(version)
    .option("-w, --workspace <slug>", "override the active workspace for this command");

  registerWorkspaceCommands(program, container);
  registerProjectCommands(program, container);
  registerTagCommands(program, container);
  registerEntryCommands(program, container);
  registerReportCommands(program, container);
  registerInvoiceCommands(program, container);
  registerExportCommands(program, container);
  registerEarningsCommands(program, container);
  registerRateCommands(program, container);
  registerConfigCommands(program, container);
  registerBackupCommands(program, container);
  registerRestoreCommands(program, container);
  registerMcpCommand(program, container);
  registerGitHookCommands(program, container);

  return program;
}
