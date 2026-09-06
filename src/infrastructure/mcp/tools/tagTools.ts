import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import { jsonResult, safeHandler, serializeTag } from "../shared.js";

/** Tag CRUD tools, scoped to the active (or given) workspace (mirrors `tck tag`). */
export function registerTagTools(server: McpServer, container: Container): void {
  server.registerTool(
    "list_tags",
    {
      title: "List tags",
      description: "List tags in a workspace (defaults to the active one)",
      inputSchema: {
        workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
      },
    },
    safeHandler(async ({ workspace }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const tags = await container.tagService.list(ws.id);
      return jsonResult(tags.map(serializeTag));
    }),
  );

  server.registerTool(
    "create_tag",
    {
      title: "Create tag",
      description: "Create a tag in a workspace (defaults to the active one)",
      inputSchema: {
        name: z.string(),
        workspace: z.string().optional().describe("Workspace slug; defaults to the active workspace"),
      },
    },
    safeHandler(async ({ name, workspace }) => {
      const ws = await container.workspaceService.resolveActive(workspace);
      const tag = await container.tagService.create({ workspaceId: ws.id, name });
      return jsonResult(serializeTag(tag));
    }),
  );
}
