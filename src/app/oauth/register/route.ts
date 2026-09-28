/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591).
 *
 * POST /oauth/register (application/json) — AI apps (claude.ai, ChatGPT,
 * Claude Code, …) register themselves as PUBLIC clients before sending a person
 * to /oauth/authorize. Validation and the trust model live in
 * src/services/auth/oauthRegistration.ts; this route is HTTP only.
 *
 * Errors follow RFC 7591 §3.2.2 ({ error, error_description }, 400).
 */
import { NextRequest } from 'next/server';
import { registerClient, validateRegistration } from '@/services/auth/oauthRegistration';
import { rateLimitOAuthRegistration, rateLimitHeaders } from '@/lib/rate-limit';
import { OPEN_CORS_HEADERS, corsPreflight } from '@/lib/oauth/metadata';
import { logger } from '@/utils/logger';

export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...OPEN_CORS_HEADERS };

function err(error: string, description: string, status = 400, extra: Record<string, string> = {}) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { ...HEADERS, ...extra } }
  );
}

export async function POST(req: NextRequest) {
  const rl = await rateLimitOAuthRegistration(req);
  if (!rl.success) {
    return err('rate_limited', 'too many registrations from this address; try again later', 429, {
      ...rateLimitHeaders(rl),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err('invalid_client_metadata', 'expected an application/json body');
  }

  const validated = validateRegistration(body);
  if (!validated.ok) {
    return err(validated.error, validated.description);
  }

  try {
    const registered = await registerClient(validated.metadata);
    logger.info(
      'OAuth client self-registered',
      {
        clientId: registered.client_id,
        clientName: registered.client_name,
        redirectHosts: registered.redirect_uris.map(u => new URL(u).host),
      },
      'OAuth'
    );
    return Response.json(registered, { status: 201, headers: HEADERS });
  } catch (error) {
    logger.error('Client registration failed', error, 'OAuth');
    return err('server_error', 'could not register the client', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
