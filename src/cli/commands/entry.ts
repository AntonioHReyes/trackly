import type { Command } from "commander";
import type { Container } from "../container.js";
import type { TimeEntry } from "../../domain/entities/TimeEntry.js";
import type { TimeEntryFilter } from "../../domain/repositories/TimeEntryRepository.js";
import type { TimeEntryEdit } from "../../application/services/TimeEntryService.js";
import {
  addDateRangeOptions,
  resolveDateRangeFromOptions,
  type DateRangeCliOptions,
} from "./dateRangeOptions.js";
import { resolveProjectId, resolveTagIds } from "./lookups.js";
import * as ui from "../ui/index.js";

interface WorkspaceOpts {
  workspace?: string;
}

const DESCRIPTION_MAX_WIDTH = 60;

const ENTRY_COLUMNS: ui.Column[] = [
  { header: "ID" },
  { header: "Start" },
  { header: "Duration", align: "right" },
  { header: "Description", maxWidth: DESCRIPTION_MAX_WIDTH },
  { header: "Project" },
  { header: "Bill" },
  { header: "Rate", align: "right" },
];

/** The rate an entry is billed at (frozen on it), or a dash if unresolved/non-billable. */
function rateCell(entry: TimeEntry, currency: string): string {
  return entry.rate !== null ? `${ui.formatMoney(entry.rate, currency)}/h` : ui.dim("—");
}

function durationCell(entry: TimeEntry): string {
  return entry.isRunning()
    ? ui.green(`● ${ui.formatDuration(entry.durationMs())}`)
    : ui.formatDuration(entry.durationMs());
}

function billableCell(entry: TimeEntry): string {
  return entry.billable ? ui.green("$") : ui.dim("–");
}

function entryRow(entry: TimeEntry, currency: string, projectName?: string): string[] {
  return [
    ui.dim(ui.shortId(entry.id)),
    ui.formatLocalDateTime(entry.startTs),
    durationCell(entry),
    entry.description,
    ui.orDash(projectName && ui.cyan(projectName)),
    billableCell(entry),
    rateCell(entry, currency),
  ];
}

/** `tck start/stop/add/edit/rm/status/list` (see SPEC.md's Entries/Query commands). */
export function registerEntryCommands(program: Command, container: Container): void {
  const workspaceOverride = (): string | undefined => (program.opts() as WorkspaceOpts).workspace;

  program
    .command("start <description>")
    .description("Start a new time entry (auto-stops any entry already running)")
    .option("--project <name>", "project name")
    .option("--tags <names>", "comma-separated tag names")
    .option("--no-billable", "mark as non-billable")
    .option(
      "--rate <amount>",
      "bill this entry at a specific rate instead of the project/workspace one",
    )
    .action(
      async (
        description: string,
        options: { project?: string; tags?: string; billable: boolean; rate?: string },
      ) => {
        const workspace = await container.workspaceService.resolveActive(workspaceOverride());
        const projectId = options.project
          ? await resolveProjectId(container, workspace.id, options.project)
          : null;
        const tagIds = options.tags
          ? await resolveTagIds(container, workspace.id, options.tags)
          : [];
        const entry = await container.timeEntryService.start({
          workspaceId: workspace.id,
          description,
          projectId,
          billable: options.billable,
          tagIds,
          ...(options.rate !== undefined ? { rate: Number.parseFloat(options.rate) } : {}),
        });
        const where = options.project ? ` in ${ui.cyan(options.project)}` : "";
        ui.success(`Started ${ui.em(entry.description)}${where}`);
        ui.hint(`${ui.formatLocalTime(entry.startTs)} · id ${ui.shortId(entry.id)} · tck stop`);
      },
    );

  program
    .command("stop")
    .description("Stop the currently running time entry")
    .action(async () => {
      const workspace = await container.workspaceService.resolveActive(workspaceOverride());
      const stopped = await container.timeEntryService.stop(workspace.id);
      ui.success(
        `Stopped ${ui.em(stopped.description)} after ${ui.bold(ui.formatDuration(stopped.durationMs()))}`,
      );
      ui.hint(
        `${ui.formatLocalTime(stopped.startTs)} → ${ui.formatLocalTime(stopped.endTs ?? new Date())} · ${ui.formatHours(stopped.durationMs())}`,
      );
    });

  program
    .command("add <description>")
    .description("Add a completed time entry")
    .requiredOption("--from <datetime>", "start (ISO datetime)")
    .requiredOption("--to <datetime>", "end (ISO datetime)")
    .option("--project <name>", "project name")
    .option("--tags <names>", "comma-separated tag names")
    .option("--no-billable", "mark as non-billable")
    .option(
      "--rate <amount>",
      "bill this entry at a specific rate instead of the project/workspace one",
    )
    .action(
      async (
        description: string,
        options: {
          from: string;
          to: string;
          project?: string;
          tags?: string;
          billable: boolean;
          rate?: string;
        },
      ) => {
        const workspace = await container.workspaceService.resolveActive(workspaceOverride());
        const projectId = options.project
          ? await resolveProjectId(container, workspace.id, options.project)
          : null;
        const tagIds = options.tags
          ? await resolveTagIds(container, workspace.id, options.tags)
          : [];
        const entry = await container.timeEntryService.addManual({
          workspaceId: workspace.id,
          description,
          startTs: new Date(options.from),
          endTs: new Date(options.to),
          projectId,
          billable: options.billable,
          tagIds,
          ...(options.rate !== undefined ? { rate: Number.parseFloat(options.rate) } : {}),
        });
        ui.success(
          `Added ${ui.em(entry.description)} (${ui.bold(ui.formatDuration(entry.durationMs()))})`,
        );
        ui.hint(
          `${ui.formatLocalDateTime(entry.startTs)} → ${ui.formatLocalTime(entry.endTs ?? entry.startTs)} · id ${ui.shortId(entry.id)}`,
        );
      },
    );

  program
    .command("edit <id>")
    .description("Edit a time entry (id may be a unique prefix)")
    .option("--description <text>")
    .option("--project <name>")
    .option("--from <datetime>")
    .option("--to <datetime>")
    .option("--tags <names>", "comma-separated tag names (replaces existing tags)")
    .option(
      "--rate <amount>",
      "bill this entry at a specific rate instead of the auto-resolved one (e.g. a one-off higher rate)",
    )
    .action(
      async (
        id: string,
        options: {
          description?: string;
          project?: string;
          from?: string;
          to?: string;
          tags?: string;
          rate?: string;
        },
      ) => {
        const entry = await container.timeEntryService.getById(id);
        const updates: TimeEntryEdit = {};
        if (options.description !== undefined) updates.description = options.description;
        if (options.from !== undefined) updates.startTs = new Date(options.from);
        if (options.to !== undefined) updates.endTs = new Date(options.to);
        if (options.project !== undefined) {
          updates.projectId = await resolveProjectId(container, entry.workspaceId, options.project);
        }
        if (options.tags !== undefined) {
          updates.tagIds = await resolveTagIds(container, entry.workspaceId, options.tags);
        }
        if (options.rate !== undefined) updates.rate = Number.parseFloat(options.rate);
        const updated = await container.timeEntryService.edit(id, updates);
        ui.success(`Updated ${ui.em(updated.description)} ${ui.dim(ui.shortId(updated.id))}`);
      },
    );

  program
    .command("rm <id>")
    .description("Delete a time entry (id may be a unique prefix)")
    .action(async (id: string) => {
      const entry = await container.timeEntryService.getById(id);
      await container.timeEntryService.remove(entry.id);
      ui.success(`Deleted ${ui.em(entry.description)} ${ui.dim(ui.shortId(entry.id))}`);
    });

  program
    .command("show <id>")
    .description("Show one entry in full (id may be a unique prefix) — no description truncation")
    .action(async (id: string) => {
      const workspace = await container.workspaceService.resolveActive(workspaceOverride());
      const entry = await container.timeEntryService.getById(id);
      const project = entry.projectId
        ? await container.projectService.getById(entry.projectId)
        : undefined;
      const tagNames = new Map(
        (await container.tagService.list(workspace.id)).map((t) => [t.id, t.name]),
      );
      const tags = entry.tagIds.map((tagId) => tagNames.get(tagId) ?? ui.shortId(tagId));

      ui.print(
        ui.renderDetails([
          ["Description", ui.em(entry.description)],
          ["Project", ui.orDash(project && ui.cyan(project.name))],
          ["Tags", tags.length > 0 ? tags.map((t) => ui.magenta(`#${t}`)).join(" ") : ui.dim("—")],
          ["Start", ui.formatLocalDateTime(entry.startTs)],
          ["Duration", entry.isRunning() ? ui.green(`● ${ui.formatDuration(entry.durationMs())}`) : ui.formatDuration(entry.durationMs())],
          ["Billable", entry.billable ? ui.green("yes") : ui.dim("no")],
          ["Rate", rateCell(entry, workspace.currency)],
          ["ID", ui.dim(entry.id)],
        ]),
      );
    });

  program
    .command("status")
    .description("Show the currently running time entry, if any")
    .action(async () => {
      const workspace = await container.workspaceService.resolveActive(workspaceOverride());
      const running = await container.timeEntryService.status(workspace.id);
      if (!running) {
        ui.empty("No time entry is running.", 'tck start "what you are doing"');
        return;
      }
      const project = running.projectId
        ? await container.projectService.getById(running.projectId)
        : undefined;
      const tagNames = new Map(
        (await container.tagService.list(workspace.id)).map((t) => [t.id, t.name]),
      );
      const tags = running.tagIds.map((tagId) => tagNames.get(tagId) ?? ui.shortId(tagId));

      ui.heading(`${ui.green("●")} Running`, `in ${workspace.slug}`);
      ui.print(
        ui.renderDetails([
          ["Description", ui.em(running.description)],
          ["Project", ui.orDash(project && ui.cyan(project.name))],
          ["Tags", tags.length > 0 ? tags.map((t) => ui.magenta(`#${t}`)).join(" ") : ui.dim("—")],
          ["Started", ui.formatLocalDateTime(running.startTs)],
          ["Elapsed", ui.bold(ui.formatDuration(running.durationMs()))],
          ["Billable", running.billable ? ui.green("yes") : ui.dim("no")],
          ["Rate", rateCell(running, workspace.currency)],
          ["ID", ui.dim(running.id)],
        ]),
      );
    });

  const list = addDateRangeOptions(program.command("list"))
    .description("List time entries")
    .option("--project <name>", "filter by project name")
    .option("--tag <name>", "filter by tag name")
    .option("--billable", "only billable entries")
    .option("--non-billable", "only non-billable entries");

  list.action(
    async (
      options: DateRangeCliOptions & {
        project?: string;
        tag?: string;
        billable?: boolean;
        nonBillable?: boolean;
      },
    ) => {
      const workspace = await container.workspaceService.resolveActive(workspaceOverride());
      const weekStart = container.configStore.read().weekStart;
      const range = resolveDateRangeFromOptions(options, weekStart);
      const projectId = options.project
        ? await resolveProjectId(container, workspace.id, options.project)
        : undefined;
      const tagId = options.tag
        ? (await resolveTagIds(container, workspace.id, options.tag))[0]
        : undefined;
      const billable = options.billable ? true : options.nonBillable ? false : undefined;

      const filter: TimeEntryFilter = { workspaceId: workspace.id };
      if (range) filter.range = range;
      if (projectId) filter.projectId = projectId;
      if (tagId) filter.tagId = tagId;
      if (billable !== undefined) filter.billable = billable;

      const entries = await container.timeEntryService.list(filter);
      if (entries.length === 0) {
        ui.empty("No time entries found.", 'tck start "what you are doing"');
        return;
      }
      const projectNames = new Map(
        (await container.projectService.list(workspace.id, true)).map((p) => [p.id, p.name]),
      );
      const rows = entries.map((entry) =>
        entryRow(
          entry,
          workspace.currency,
          entry.projectId ? projectNames.get(entry.projectId) : undefined,
        ),
      );
      const totalMs = entries.reduce((sum, e) => sum + e.durationMs(), 0);
      const billableMs = entries
        .filter((e) => e.billable)
        .reduce((sum, e) => sum + e.durationMs(), 0);

      ui.heading("Time entries", `${workspace.slug} · ${entries.length}`);
      ui.print(
        ui.renderTable(ENTRY_COLUMNS, rows, {
          footer: [
            "",
            ui.bold("Total"),
            ui.bold(ui.formatDuration(totalMs)),
            ui.dim(`${ui.formatHours(totalMs)} · billable ${ui.formatHours(billableMs)}`),
            "",
            "",
            "",
          ],
        }),
      );
      if (entries.some((e) => e.description.length > DESCRIPTION_MAX_WIDTH)) {
        ui.print(ui.dim("  Descriptions truncated — run `tck show <id>` to see one in full."));
      }
    },
  );
}
