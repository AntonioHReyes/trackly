import type { Command } from "commander";
import type { Container } from "../container.js";
import { DomainError } from "../../domain/errors/DomainError.js";
import * as ui from "../ui/index.js";

async function activeWorkspaceId(container: Container): Promise<string | null> {
  try {
    return (await container.workspaceService.resolveActive()).id;
  } catch (error) {
    if (error instanceof DomainError) return null;
    throw error;
  }
}

/** `tck workspace create/list/switch/rm` (see SPEC.md's Commands table). */
export function registerWorkspaceCommands(program: Command, container: Container): void {
  const workspace = program
    .command("workspace")
    .description("Manage workspaces (clients/contexts)");

  workspace
    .command("create <slug> <name>")
    .description("Create a new workspace")
    .option("--currency <code>", "ISO currency code", "USD")
    .option("--rate <amount>", "default hourly rate", parseFloat)
    .action(async (slug: string, name: string, options: { currency: string; rate?: number }) => {
      const created = await container.workspaceService.create({
        slug,
        name,
        currency: options.currency,
        defaultHourlyRate: options.rate ?? null,
      });
      ui.success(`Created workspace ${ui.em(created.name)} ${ui.dim(`(${created.slug})`)}`);
      ui.hint(`tck workspace switch ${created.slug}`);
    });

  workspace
    .command("list")
    .description("List all workspaces")
    .action(async () => {
      const workspaces = await container.workspaceService.list();
      if (workspaces.length === 0) {
        ui.empty("No workspaces yet.", "tck workspace create <slug> <name>");
        return;
      }
      const activeId = await activeWorkspaceId(container);
      const rows = workspaces.map((w) => {
        const active = w.id === activeId;
        return [
          active ? ui.green("●") : " ",
          active ? ui.em(w.slug) : w.slug,
          w.name,
          w.currency,
          w.defaultHourlyRate === null
            ? ui.dim("—")
            : ui.formatMoney(w.defaultHourlyRate, w.currency),
        ];
      });
      ui.heading("Workspaces", `${workspaces.length}`);
      ui.print(
        ui.renderTable(
          ["", "Slug", "Name", "Currency", { header: "Default rate", align: "right" }],
          rows,
        ),
      );
    });

  workspace
    .command("set-currency <slug> <code>")
    .description("Change a workspace's currency")
    .action(async (slug: string, code: string) => {
      const updated = await container.workspaceService.setCurrency(slug, code);
      ui.success(`Currency for ${ui.em(updated.slug)} is now ${ui.bold(updated.currency)}`);
    });

  workspace
    .command("switch <slug>")
    .description("Set the active workspace")
    .action(async (slug: string) => {
      const switched = await container.workspaceService.switchActive(slug);
      ui.success(`Active workspace: ${ui.em(switched.slug)} ${ui.dim(`(${switched.name})`)}`);
    });

  workspace
    .command("rm <slug>")
    .description("Delete a workspace and everything in it")
    .action(async (slug: string) => {
      await container.workspaceService.remove(slug);
      ui.success(`Deleted workspace ${ui.em(slug)} and all of its data`);
    });
}
