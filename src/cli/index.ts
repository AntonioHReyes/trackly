#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Command } from "commander";
import { Container } from "./container.js";
import { DomainError } from "../domain/errors/DomainError.js";
import * as ui from "./ui/index.js";
import { registerWorkspaceCommands } from "./commands/workspace.js";
import { registerProjectCommands } from "./commands/project.js";
import { registerTagCommands } from "./commands/tag.js";
import { registerEntryCommands } from "./commands/entry.js";
import { registerReportCommands } from "./commands/report.js";
import { registerInvoiceCommands } from "./commands/invoice.js";
import { registerExportCommands } from "./commands/export.js";
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

// Composition root and feature commands are wired in here as each phase
// lands (see PLAN.md). Kept deliberately empty otherwise — this file's only
// job is bootstrapping the CLI, never business logic.
async function main(): Promise<void> {
  const container = new Container();
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
  registerRateCommands(program, container);
  registerConfigCommands(program, container);
  registerBackupCommands(program, container);
  registerRestoreCommands(program, container);
  registerMcpCommand(program, container);
  registerGitHookCommands(program, container);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof DomainError) {
      ui.error(error.message);
      process.exitCode = 1;
    } else {
      throw error;
    }
  } finally {
    container.close();
  }
}

void main();
