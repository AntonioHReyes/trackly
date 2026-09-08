import type { Command } from "commander";
import type { Container } from "../container.js";
import type { Project } from "../../domain/entities/Project.js";
import * as ui from "../ui/index.js";

interface WorkspaceOpts {
  workspace?: string;
}

function nameCell(project: Project): string {
  const swatch = project.color ? ui.hexColor(project.color)("■") + " " : "";
  const name = project.archived ? ui.dim(project.name) : ui.em(project.name);
  return swatch + name;
}

/** `tck project create/list/edit/archive/rm` (see SPEC.md's Commands table). */
export function registerProjectCommands(program: Command, container: Container): void {
  const project = program.command("project").description("Manage projects within a workspace");

  project
    .command("create <name>")
    .description("Create a project in the active (or -w) workspace")
    .option("--client <name>", "client name")
    .option("--color <hex>", "display color")
    .option("--rate <amount>", "hourly rate override for this project", parseFloat)
    .action(async (name: string, options: { client?: string; color?: string; rate?: number }) => {
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      const created = await container.projectService.create({
        workspaceId: workspace.id,
        name,
        client: options.client ?? null,
        color: options.color ?? null,
        hourlyRate: options.rate ?? null,
      });
      ui.success(`Created project ${nameCell(created)} in ${ui.cyan(workspace.slug)}`);
      ui.hint(`tck start "..." --project "${created.name}"`);
    });

  project
    .command("list")
    .description("List projects in the active (or -w) workspace")
    .option("--archived", "include archived projects")
    .option("--client <name>", "only show this client's projects")
    .action(async (options: { archived?: boolean; client?: string }) => {
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      const projects = await container.projectService.list(
        workspace.id,
        options.archived ?? false,
        options.client,
      );
      if (projects.length === 0) {
        ui.empty("No projects yet.", "tck project create <name>");
        return;
      }
      const rows = projects.map((p) => [
        ui.dim(ui.shortId(p.id)),
        nameCell(p),
        ui.orDash(p.client),
        p.hourlyRate === null
          ? ui.dim(`${ui.formatMoney(workspace.defaultHourlyRate ?? 0, workspace.currency)} ↑`)
          : ui.formatMoney(p.hourlyRate, workspace.currency),
        p.archived ? ui.yellow("archived") : ui.green("active"),
      ]);
      ui.heading("Projects", `${workspace.slug} · ${projects.length}`);
      ui.print(
        ui.renderTable(
          ["ID", "Name", "Client", { header: "Rate", align: "right" }, "Status"],
          rows,
        ),
      );
      if (projects.some((p) => p.hourlyRate === null)) {
        ui.hint("↑ inherits the workspace default rate");
      }
    });

  project
    .command("edit <id>")
    .description("Edit a project")
    .option("--name <name>")
    .option("--client <name>")
    .option("--color <hex>")
    .option("--rate <amount>", "hourly rate override", parseFloat)
    .action(
      async (
        id: string,
        options: { name?: string; client?: string; color?: string; rate?: number },
      ) => {
        const updates: {
          name?: string;
          client?: string | null;
          color?: string | null;
          hourlyRate?: number | null;
        } = {};
        if (options.name !== undefined) updates.name = options.name;
        if (options.client !== undefined) updates.client = options.client;
        if (options.color !== undefined) updates.color = options.color;
        if (options.rate !== undefined) updates.hourlyRate = options.rate;

        const updated = await container.projectService.edit(id, updates);
        ui.success(`Updated project ${nameCell(updated)}`);
      },
    );

  project
    .command("archive <id>")
    .description("Archive a project")
    .action(async (id: string) => {
      const archived = await container.projectService.archive(id);
      ui.success(`Archived project ${ui.em(archived.name)}`);
    });

  project
    .command("rm <id>")
    .description("Delete a project")
    .action(async (id: string) => {
      const target = await container.projectService.getById(id);
      await container.projectService.remove(id);
      ui.success(`Deleted project ${ui.em(target.name)}`);
    });
}
