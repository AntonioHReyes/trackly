import type { Command } from "commander";
import type { Container } from "../container.js";
import { resolveProjectId } from "./lookups.js";
import * as ui from "../ui/index.js";

interface WorkspaceOpts {
  workspace?: string;
}

/**
 * `tck rate set <amount> [--project <name>]` — a simplified take on
 * SPEC.md's `rate set --workspace|--project <amount>`: the workspace is
 * always the active (or `-w`) one, and `--project` targets that workspace's
 * project instead of a separate `--workspace` flag (per-project rates
 * already override the workspace default via `Project.resolveRate`).
 */
export function registerRateCommands(program: Command, container: Container): void {
  const rate = program.command("rate").description("Set hourly rates");

  rate
    .command("set <amount>")
    .description("Set the default rate for the active workspace, or a project's rate override")
    .option("--project <name>", "set this project's rate instead of the workspace default")
    .action(async (amountRaw: string, options: { project?: string }) => {
      const amount = Number.parseFloat(amountRaw);
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      if (options.project) {
        const projectId = await resolveProjectId(container, workspace.id, options.project);
        const updated = await container.projectService.edit(projectId, { hourlyRate: amount });
        ui.success(
          `Rate for project ${ui.em(updated.name)} is now ${ui.bold(ui.formatMoney(amount, workspace.currency))}/h`,
        );
        return;
      }
      const updated = await container.workspaceService.setDefaultRate(workspace.slug, amount);
      ui.success(
        `Default rate for ${ui.em(updated.slug)} is now ${ui.bold(ui.formatMoney(amount, updated.currency))}/h`,
      );
    });
}
