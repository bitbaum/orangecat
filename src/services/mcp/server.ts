/**
 * OrangeCat's MCP server — Streamable HTTP, stateless.
 *
 * A fresh McpServer + transport per request: no session ids, nothing held in
 * memory between calls, so any process can answer any request and a restart
 * loses nothing. JSON responses rather than SSE — every tool answers in one
 * round trip, so there is nothing to stream.
 *
 * The route (src/app/api/mcp/route.ts) authenticates first; this module only
 * ever sees an authenticated caller, and gates each tool on its scope.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { hasScope } from '@/lib/api/resolveRequestAuth';
import { logger } from '@/utils/logger';
import type { McpCaller } from './auth';
import { MCP_TOOLS, missingScopeError, toolError, type McpTool } from './tools';

export const MCP_SERVER_INFO = { name: 'orangecat', title: 'OrangeCat', version: '1.0.0' } as const;

const INSTRUCTIONS =
  'OrangeCat is where people fund, sell, lend, invest and govern — with Bitcoin or any other currency. ' +
  'These tools act for the one person who connected this app: search what is public, list their own ' +
  'projects, create a project (as a draft unless told otherwise) and post updates to it. Confirm before ' +
  'creating anything, and tell the person when something you made is still a draft.';

function guarded(tool: McpTool, caller: McpCaller, request: Request) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    const needed = tool.scopeFor?.(args ?? {}) ?? tool.scope;
    if (needed && !hasScope(caller.scopes, needed)) {
      return missingScopeError(tool.name, needed);
    }
    try {
      return await tool.run(args ?? {}, { caller, request });
    } catch (error) {
      logger.error('MCP tool failed', { tool: tool.name, error }, 'MCP');
      return toolError(`${tool.name} failed on OrangeCat's side. Try again in a moment.`);
    }
  };
}

/** Build a server whose tools act as `caller`. */
export function createOrangeCatMcpServer(caller: McpCaller, request: Request): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, { instructions: INSTRUCTIONS });
  for (const tool of MCP_TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      guarded(tool, caller, request) as never
    );
  }
  return server;
}

/** Answer one Streamable HTTP POST for an authenticated caller. */
export async function handleMcpPost(request: Request, caller: McpCaller): Promise<Response> {
  const server = createOrangeCatMcpServer(caller, request);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // Stateless: nothing outlives the request.
    void server.close();
  }
}
