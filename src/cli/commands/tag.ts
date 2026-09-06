import type { Command } from "commander";
import type { Container } from "../container.js";
import * as ui from "../ui/index.js";

interface WorkspaceOpts {
  workspace?: string;
}

/** `tck tag create/list/rm` (see SPEC.md's Commands table). */
export function registerTagCommands(program: Command, container: Container): void {
  const tag = program.command("tag").description("Manage tags within a workspace");

  tag
    .command("create <name>")
    .description("Create a tag in the active (or -w) workspace")
    .action(async (name: string) => {
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      const created = await container.tagService.create({ workspaceId: workspace.id, name });
      ui.success(`Created tag ${ui.magenta(`#${created.name}`)} in ${ui.cyan(workspace.slug)}`);
    });

  tag
    .command("list")
    .description("List tags in the active (or -w) workspace")
    .action(async () => {
      const workspace = await container.workspaceService.resolveActive(
        (program.opts() as WorkspaceOpts).workspace,
      );
      const tags = await container.tagService.list(workspace.id);
      if (tags.length === 0) {
        ui.empty("No tags yet.", "tck tag create <name>");
        return;
      }
      const rows = tags.map((t) => [ui.dim(ui.shortId(t.id)), ui.magenta(`#${t.name}`)]);
      ui.heading("Tags", `${workspace.slug} · ${tags.length}`);
      ui.print(ui.renderTable(["ID", "Name"], rows));
    });

  tag
    .command("rm <id>")
    .description("Delete a tag")
    .action(async (id: string) => {
      const target = await container.tagService.getById(id);
      await container.tagService.remove(id);
      ui.success(`Deleted tag ${ui.magenta(`#${target.name}`)}`);
    });
}
