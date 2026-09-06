import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import { jsonResult, safeHandler, serializeProject } from "../shared.js";

/** Project CRUD tools, scoped to the active (or given) workspace (mirrors `tck project`). */
export function registerProjectTools(server: McpServer, container: Container): void {
  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects in a workspace (defaults to the active one)",
      inputSchema: {
        workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
        includeArchived: z.boolean().optional().default(false),
      },
    },
    safeHandler(async ({ workspace, includeArchived }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const projects = await container.projectService.list(ws.id, includeArchived);
      return jsonResult(projects.map(serializeProject));
    }),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description: "Create a project in a workspace (defaults to the active one)",
      inputSchema: {
        name: z.string(),
        workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
        client: z.string().optional(),
        color: z.string().optional().describe("Hex color, e.g. `#3B82F6`"),
        hourlyRate: z.number().optional().describe("Overrides the workspace's default rate for this project"),
      },
    },
    safeHandler(async ({ name, workspace, client, color, hourlyRate }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const project = await container.projectService.create({
        workspaceId: ws.id,
        name,
        client: client ?? null,
        color: color ?? null,
        hourlyRate: hourlyRate ?? null,
      });
      return jsonResult(serializeProject(project));
    }),
  );

  server.registerTool(
    "archive_project",
    {
      title: "Archive project",
      description: "Archive a project by id so it stops showing up in default listings",
      inputSchema: { id: z.string() },
    },
    safeHandler(async ({ id }) => {
      const project = await container.projectService.archive(id);
      return jsonResult(serializeProject(project));
    }),
  );
}
