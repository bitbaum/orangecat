/**
 * OrangeCat's MCP server endpoint — what an AI app connects to.
 *
 * POST /api/mcp  (Streamable HTTP, stateless, JSON responses)
 *   Authorization: Bearer <OrangeCat access token for this resource | ock_ key>
 * GET / DELETE → 405 once authenticated (no SSE stream to open, no session to
 * end); 401 before that, like POST, so a client probing with GET still finds
 * the sign-in metadata.
 *
 * Auth lives in src/services/mcp/auth.ts, the server and tools in
 * src/services/mcp/. This file is HTTP only.
 *
 * Not on the apiSuccess envelope on purpose: MCP is JSON-RPC, and the 401
 * speaks RFC 6750 / RFC 9728 because that is what MCP clients parse.
 */
import { authenticateMcpRequest } from '@/services/mcp/auth';
import { handleMcpPost } from '@/services/mcp/server';
import { OPEN_CORS_HEADERS, corsPreflight } from '@/lib/oauth/metadata';
import { rateLimitMcp, rateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

function withCors(res: Response): Response {
  for (const [k, v] of Object.entries(OPEN_CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

function methodNotAllowed(): Response {
  return Response.json(
    {
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed: this server is stateless; use POST.' },
      id: null,
    },
    { status: 405, headers: { ...OPEN_CORS_HEADERS, Allow: 'POST, OPTIONS' } }
  );
}

export async function POST(req: Request) {
  const auth = await authenticateMcpRequest(req);
  if (!auth.ok) {
    return auth.response;
  }
  const rl = await rateLimitMcp(auth.caller.userId);
  if (!rl.success) {
    return Response.json(
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Too many requests. Slow down.' },
        id: null,
      },
      { status: 429, headers: { ...OPEN_CORS_HEADERS, ...rateLimitHeaders(rl) } }
    );
  }
  try {
    return withCors(await handleMcpPost(req, auth.caller));
  } catch (error) {
    logger.error('MCP request failed', error, 'MCP');
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null },
      { status: 500, headers: OPEN_CORS_HEADERS }
    );
  }
}

async function notAllowedOnceAuthenticated(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(req);
  return auth.ok ? methodNotAllowed() : auth.response;
}

export function GET(req: Request) {
  return notAllowedOnceAuthenticated(req);
}

export function DELETE(req: Request) {
  return notAllowedOnceAuthenticated(req);
}

export function OPTIONS() {
  return corsPreflight();
}
