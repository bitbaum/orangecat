/**
 * POST /oauth/person-tags — an app asks which of its accounts are one person
 * (ADR-0014 D7).
 *
 * Body (JSON): { client_id, client_secret, scope, subjects: [actor id, ...] }.
 * Answer: { tags: { <actor id>: <tag> } }. Two accounts share a tag exactly
 * when one person holds both. An account that is absent from `tags` could not
 * be told apart; it is not "someone else".
 *
 * WHO MAY ASK. Only a confidential client that OrangeCat trusts, proving
 * itself with its secret. The tag is keyed per client and per scope, so what
 * one app learns cannot be matched against another's, and a self-registered
 * app cannot ask at all: for it, "are these two accounts one person" is
 * exactly the thing identities exist to keep private.
 *
 * Server to server: no cookie is read and none is set.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createRateLimitResponse, rateLimit } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { getClient, verifyClientSecret } from '@/services/auth/oauthProvider';
import { personTagsFor } from '@/domain/identities/personTags';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store', Pragma: 'no-cache' };

function err(error: string, description: string, status: number) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: NO_STORE }
  );
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request);
  if (!limited.success) {
    return createRateLimitResponse(limited);
  }

  let body: { client_id?: unknown; client_secret?: unknown; scope?: unknown; subjects?: unknown };
  try {
    body = await request.json();
  } catch {
    return err('invalid_request', 'expected a JSON body', 400);
  }

  const clientId = typeof body.client_id === 'string' ? body.client_id : '';
  const secret = typeof body.client_secret === 'string' ? body.client_secret : null;
  const client = clientId ? await getClient(clientId) : null;
  // One answer for an unknown app, a public one and a wrong secret.
  if (!client || !client.is_confidential || !verifyClientSecret(client, secret)) {
    return err('invalid_client', 'client authentication failed', 401);
  }
  if (!client.is_trusted) {
    return err('unauthorized_client', 'this client may not ask for person tags', 403);
  }

  const result = await personTagsFor(getAdminClient(), client.client_id, body.scope, body.subjects);
  if (!result.ok) {
    if (result.reason === 'failed') {
      return err('server_error', 'person tags are unavailable; try again', 503);
    }
    return err(
      'invalid_request',
      result.reason === 'invalid_scope'
        ? 'scope must be a non-empty string of at most 200 characters'
        : 'subjects must be a list of 1 to 100 actor ids',
      400
    );
  }
  return NextResponse.json({ tags: result.tags }, { headers: NO_STORE });
}
