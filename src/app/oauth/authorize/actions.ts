'use server';

/**
 * Consent actions for /oauth/authorize.
 *
 * Security: these re-validate EVERYTHING server-side (session, client, exact
 * redirect-uri, allowed scopes) — the hidden form fields are inputs, not trust.
 * The redirect_uri is always re-checked against the client's registered list
 * before we ever redirect to it.
 */
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import {
  getClient,
  clientAllowsRedirect,
  effectiveScopes,
  createAuthCode,
  recordGrant,
} from '@/services/auth/oauthProvider';
import { logger } from '@/utils/logger';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

function withParams(base: string, params: Record<string, string | undefined>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export async function approveAuthorization(formData: FormData): Promise<void> {
  const f = (k: string) => {
    const v = formData.get(k);
    return typeof v === 'string' ? v : '';
  };
  const clientId = f('client_id');
  const redirectUri = f('redirect_uri');
  const state = f('state');
  const scopeStr = f('scope');
  const codeChallenge = f('code_challenge');
  const codeChallengeMethod = f('code_challenge_method') || 'S256';
  const nonce = f('nonce');

  // Re-validate the client + redirect from the DB — never trust the form.
  const client = await getClient(clientId);
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    // Can't safely bounce to an unvalidated URI — fail to a local error page.
    redirect('/oauth/error?reason=invalid_client_or_redirect');
  }

  const {
    data: { user },
  } = await (await createServerClient()).auth.getUser();
  if (!user) {
    redirect(authLoginPath('/oauth/authorize'));
  }

  const scopes = effectiveScopes(client!, scopeStr.split(/\s+/).filter(Boolean));
  if (scopes.length === 0) {
    redirect(withParams(redirectUri, { error: 'invalid_scope', state }));
  }

  let target: string;
  try {
    const actor = await getOrCreateUserActor(user!.id);
    await recordGrant(user!.id, clientId, scopes);
    const code = await createAuthCode({
      clientId,
      actorId: actor.id,
      userId: user!.id,
      redirectUri,
      scopes,
      codeChallenge,
      codeChallengeMethod,
      nonce: nonce || null,
    });
    target = withParams(redirectUri, { code, state });
  } catch (error) {
    logger.error('approveAuthorization failed', error, 'OAuth');
    target = withParams(redirectUri, { error: 'server_error', state });
  }
  redirect(target);
}

export async function denyAuthorization(formData: FormData): Promise<void> {
  const redirectUri = String(formData.get('redirect_uri') ?? '');
  const state = String(formData.get('state') ?? '');
  const clientId = String(formData.get('client_id') ?? '');

  const client = await getClient(clientId);
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    redirect('/oauth/error?reason=invalid_client_or_redirect');
  }
  redirect(withParams(redirectUri, { error: 'access_denied', state }));
}
