import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Container } from "../../cli/container.js";
import { registerWorkspaceTools } from "./tools/workspaceTools.js";
import { registerProjectTools } from "./tools/projectTools.js";
import { registerTagTools } from "./tools/tagTools.js";
import { registerEntryTools } from "./tools/entryTools.js";
import { registerReportTools } from "./tools/reportTools.js";

/**
 * Builds the MCP server exposed by `tck mcp` — every tool wraps an existing
 * application service from the `Container`, so an AI client and the CLI can
 * never disagree about business rules (one timer at a time, rate
 * resolution, etc.). See PLAN.md's MCP phase.
 */
export function createMcpServer(container: Container): McpServer {
  const server = new McpServer({ name: "trackly", version: "0.1.0" });

  registerWorkspaceTools(server, container);
  registerProjectTools(server, container);
  registerTagTools(server, container);
  registerEntryTools(server, container);
  registerReportTools(server, container);

  return server;
}
