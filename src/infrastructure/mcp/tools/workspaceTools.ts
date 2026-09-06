import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../../cli/container.js";
import { jsonResult, safeHandler, serializeWorkspace } from "../shared.js";

/** Workspace CRUD + "current context" tools (mirrors `tck workspace`). */
export function registerWorkspaceTools(server: McpServer, container: Container): void {
  server.registerTool(
    "list_workspaces",
    {
      title: "List workspaces",
      description: "List every workspace, including which one (if any) is currently active",
      inputSchema: {},
    },
    safeHandler(async () => {
      const workspaces = await container.workspaceService.list();
      const active = await container.workspaceService.resolveActive().catch(() => null);
      return jsonResult(
        workspaces.map((w) => ({ ...serializeWorkspace(w), active: w.id === active?.id })),
      );
    }),
  );

  server.registerTool(
    "create_workspace",
    {
      title: "Create workspace",
      description: "Create a new workspace (a client/context isolating its own projects and time entries)",
      inputSchema: {
        slug: z.string().describe("Lowercase alphanumeric-with-dashes identifier, e.g. `acme`"),
        name: z.string().describe("Human-readable name, e.g. `Acme Corp`"),
        currency: z.string().describe("3-letter ISO currency code, e.g. `USD`"),
        defaultHourlyRate: z.number().optional().describe("Default rate applied when a project sets none"),
      },
    },
    safeHandler(async ({ slug, name, currency, defaultHourlyRate }) => {
      const workspace = await container.workspaceService.create({
        slug,
        name,
        currency,
        defaultHourlyRate: defaultHourlyRate ?? null,
      });
      return jsonResult(serializeWorkspace(workspace));
    }),
  );

  server.registerTool(
    "switch_workspace",
    {
      title: "Switch active workspace",
      description: "Set the given workspace as the active context for future entries/reports",
      inputSchema: { slug: z.string() },
    },
    safeHandler(async ({ slug }) => {
      const workspace = await container.workspaceService.switchActive(slug);
      return jsonResult(serializeWorkspace(workspace));
    }),
  );

  server.registerTool(
    "get_active_workspace",
    {
      title: "Get active workspace",
      description: "Return whichever workspace is currently the active context",
      inputSchema: {},
    },
    safeHandler(async () => {
      const workspace = await container.workspaceService.resolveActive();
      return jsonResult(serializeWorkspace(workspace));
    }),
  );
}
