import type { Command } from "commander";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Container } from "../container.js";
import { createMcpServer } from "../../infrastructure/mcp/server.js";

/**
 * `tck mcp` — runs Trackly as an MCP server over stdio, so any MCP-capable
 * AI client (Claude Code/Desktop, etc.) can start/stop timers, manage
 * projects/tags, and pull reports without shelling out to `tck` directly.
 * Point a client's MCP config at `{ "command": "tck", "args": ["mcp"] }`.
 */
export function registerMcpCommand(program: Command, container: Container): void {
  program
    .command("mcp")
    .description("Start an MCP server over stdio for AI clients to connect to")
    .action(async () => {
      const server = createMcpServer(container);
      const transport = new StdioServerTransport();
      await server.connect(transport);

      // Keep the process (and the DB connection `main()` closes in its
      // `finally`) alive until the client disconnects (stdin closes).
      await new Promise<void>((resolve) => {
        transport.onclose = resolve;
      });
    });
}
