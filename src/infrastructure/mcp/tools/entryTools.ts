import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import type { TimeEntryFilter } from "../../../domain/repositories/TimeEntryRepository.js";
import { resolveProjectId, resolveTagIds } from "../../../cli/commands/lookups.js";
import { dateRangeShape, jsonResult, resolveRangeInput, safeHandler, serializeEntry } from "../shared.js";

const workspaceField = z
  .string()
  .optional()
  .describe("Workspace slug; defaults to the active workspace");

/**
 * Resolves a workspace's projects/tags into name lookup maps, so entries can
 * be serialized with human-readable names instead of raw ids (an AI client
 * reads "Website redesign" far more usefully than a UUID).
 */
async function buildNameMaps(
  container: Container,
  workspaceId: string,
): Promise<{ projectNameById: Map<string, string>; tagNameById: Map<string, string> }> {
  const [projects, tags] = await Promise.all([
    container.projectService.list(workspaceId, true),
    container.tagService.list(workspaceId),
  ]);
  return {
    projectNameById: new Map(projects.map((p) => [p.id, p.name])),
    tagNameById: new Map(tags.map((t) => [t.id, t.name])),
  };
}

/** Start/stop/add/edit/remove/status/list tools for time entries (mirrors `tck` entry commands). */
export function registerEntryTools(server: McpServer, container: Container): void {
  server.registerTool(
    "start_entry",
    {
      title: "Start time entry",
      description:
        "Start a new time entry (auto-stops whatever is currently running in the workspace)",
      inputSchema: {
        description: z.string(),
        workspace: workspaceField,
        project: z.string().optional().describe("Project name"),
        tags: z.array(z.string()).optional().describe("Tag names"),
        billable: z.boolean().optional().default(true),
      },
    },
    safeHandler(async ({ description, workspace, project, tags, billable }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const projectId = project ? await resolveProjectId(container, ws.id, project) : null;
      const tagIds = tags?.length ? await resolveTagIds(container, ws.id, tags.join(",")) : [];
      const entry = await container.timeEntryService.start({
        workspaceId: ws.id,
        description,
        projectId,
        billable,
        tagIds,
      });
      return jsonResult(serializeEntry(entry, { projectName: project, tagNames: tags }));
    }),
  );

  server.registerTool(
    "stop_entry",
    {
      title: "Stop running time entry",
      description: "Stop the time entry currently running in a workspace (defaults to the active one)",
      inputSchema: { workspace: workspaceField },
    },
    safeHandler(async ({ workspace }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const entry = await container.timeEntryService.stop(ws.id);
      const { projectNameById } = await buildNameMaps(container, ws.id);
      return jsonResult(
        serializeEntry(entry, {
          projectName: entry.projectId ? projectNameById.get(entry.projectId) : undefined,
        }),
      );
    }),
  );

  server.registerTool(
    "get_status",
    {
      title: "Get running time entry",
      description: "Return the currently running time entry in a workspace, if any",
      inputSchema: { workspace: workspaceField },
    },
    safeHandler(async ({ workspace }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const entry = await container.timeEntryService.status(ws.id);
      if (!entry) return jsonResult(null);
      const { projectNameById } = await buildNameMaps(container, ws.id);
      return jsonResult(
        serializeEntry(entry, {
          projectName: entry.projectId ? projectNameById.get(entry.projectId) : undefined,
        }),
      );
    }),
  );

  server.registerTool(
    "add_entry",
    {
      title: "Add completed time entry",
      description: "Record an already-finished time entry with an explicit start/end",
      inputSchema: {
        description: z.string(),
        from: z.string().describe("Start (ISO datetime)"),
        to: z.string().describe("End (ISO datetime)"),
        workspace: workspaceField,
        project: z.string().optional().describe("Project name"),
        tags: z.array(z.string()).optional().describe("Tag names"),
        billable: z.boolean().optional().default(true),
      },
    },
    safeHandler(async ({ description, from, to, workspace, project, tags, billable }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const projectId = project ? await resolveProjectId(container, ws.id, project) : null;
      const tagIds = tags?.length ? await resolveTagIds(container, ws.id, tags.join(",")) : [];
      const entry = await container.timeEntryService.addManual({
        workspaceId: ws.id,
        description,
        startTs: new Date(from),
        endTs: new Date(to),
        projectId,
        billable,
        tagIds,
      });
      return jsonResult(serializeEntry(entry, { projectName: project, tagNames: tags }));
    }),
  );

  server.registerTool(
    "edit_entry",
    {
      title: "Edit time entry",
      description: "Edit an existing time entry (full id or an unambiguous id prefix)",
      inputSchema: {
        id: z.string(),
        description: z.string().optional(),
        project: z.string().optional().describe("New project name"),
        tags: z.array(z.string()).optional().describe("Replaces this entry's tags"),
        from: z.string().optional().describe("New start (ISO datetime)"),
        to: z.string().optional().describe("New end (ISO datetime)"),
        billable: z.boolean().optional(),
      },
    },
    safeHandler(async ({ id, description, project, tags, from, to, billable }) => {
      const existing = await container.timeEntryService.getById(id);
      const projectId = project
        ? await resolveProjectId(container, existing.workspaceId, project)
        : undefined;
      const tagIds = tags ? await resolveTagIds(container, existing.workspaceId, tags.join(",")) : undefined;
      const entry = await container.timeEntryService.edit(existing.id, {
        ...(description !== undefined ? { description } : {}),
        ...(projectId !== undefined ? { projectId } : {}),
        ...(from !== undefined ? { startTs: new Date(from) } : {}),
        ...(to !== undefined ? { endTs: new Date(to) } : {}),
        ...(billable !== undefined ? { billable } : {}),
        ...(tagIds !== undefined ? { tagIds } : {}),
      });
      return jsonResult(serializeEntry(entry, { projectName: project, tagNames: tags }));
    }),
  );

  server.registerTool(
    "remove_entry",
    {
      title: "Remove time entry",
      description: "Delete a time entry (full id or an unambiguous id prefix)",
      inputSchema: { id: z.string() },
    },
    safeHandler(async ({ id }) => {
      const entry = await container.timeEntryService.getById(id);
      await container.timeEntryService.remove(entry.id);
      return jsonResult({ removed: entry.id });
    }),
  );

  server.registerTool(
    "list_entries",
    {
      title: "List time entries",
      description: "List time entries in a workspace, optionally filtered by date range/project/tag/billable",
      inputSchema: {
        workspace: workspaceField,
        ...dateRangeShape,
        project: z.string().optional().describe("Filter by project name"),
        tag: z.string().optional().describe("Filter by tag name"),
        billable: z.boolean().optional().describe("Filter to billable (true) or non-billable (false) only"),
      },
    },
    safeHandler(async ({ workspace, project, tag, billable, ...rangeInput }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const weekStart = container.configStore.read().weekStart;
      const { range } = resolveRangeInput(rangeInput, weekStart);

      const filter: TimeEntryFilter = { workspaceId: ws.id };
      if (range) filter.range = range;
      if (project) filter.projectId = await resolveProjectId(container, ws.id, project);
      if (tag) {
        const tagId = (await resolveTagIds(container, ws.id, tag))[0];
        if (tagId) filter.tagId = tagId;
      }
      if (billable !== undefined) filter.billable = billable;

      const [entries, { projectNameById, tagNameById }] = await Promise.all([
        container.timeEntryService.list(filter),
        buildNameMaps(container, ws.id),
      ]);
      return jsonResult(
        entries.map((entry) =>
          serializeEntry(entry, {
            projectName: entry.projectId ? projectNameById.get(entry.projectId) : undefined,
            tagNames: entry.tagIds.map((id) => tagNameById.get(id) ?? id),
          }),
        ),
      );
    }),
  );
}
