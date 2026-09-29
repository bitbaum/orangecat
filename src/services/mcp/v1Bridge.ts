/**
 * Run a /api/v1 handler in-process on behalf of an MCP caller.
 *
 * Writes made through MCP must behave exactly like the same write made through
 * the public API — the same scope check, rate limit bucket, validation,
 * idempotency, audit row and webhook. Those live inside the v1 handlers
 * (entityPostHandler has no non-HTTP seam), so rather than re-assembling them
 * here, a tool hands the v1 handler a Request carrying the caller's own bearer
 * and reads back its answer. The handler re-authenticates that bearer itself;
 * nothing here grants anything.
 */
import { NextRequest } from 'next/server';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/** Any App Router handler: the compose()d factories take a ctx, plain ones ignore it. */
export type V1Handler = (
  req: NextRequest,
  ctx: Record<string, unknown>
) => Promise<Response> | Response;

export interface V1Result {
  status: number;
  /** The standard envelope ({ success, data } | { success: false, error }). */
  body: Record<string, unknown> | null;
}

export async function callV1(
  handler: V1Handler,
  opts: { origin: Request; path: string; bearer: string; body: unknown }
): Promise<V1Result> {
  // Start from the original headers so the client-IP hop Caddy wrote still
  // reaches the audit log and IP limiter; then state what this call is.
  const headers = new Headers(opts.origin.headers);
  headers.set('authorization', `Bearer ${opts.bearer}`);
  headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');
  headers.delete('content-length');
  // An MCP session id means nothing to a v1 handler.
  headers.delete('mcp-session-id');

  const req = new NextRequest(new URL(opts.path, opts.origin.url), {
    method: 'POST',
    headers,
    body: JSON.stringify(opts.body),
  });
  const res = await handler(req, {});
  let body: Record<string, unknown> | null = null;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/**
 * A v1 failure as one sentence for the model, validation details included —
 * a model can fix a field it is told about, and cannot fix "HTTP 422".
 */
export function describeV1Failure(result: V1Result): string {
  const message = apiErrorMessage(result.body, `OrangeCat answered HTTP ${result.status}`);
  const details = (result.body?.error as { details?: unknown } | undefined)?.details;
  return details ? `${message}: ${JSON.stringify(details)}` : message;
}
