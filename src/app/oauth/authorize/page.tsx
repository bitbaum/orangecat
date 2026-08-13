/**
 * OAuth2 / OIDC authorization endpoint (consent screen).
 *
 * GET /oauth/authorize?response_type=code&client_id&redirect_uri&scope&state
 *   &code_challenge&code_challenge_method=S256&nonce
 *
 * Validates the client + redirect BEFORE any redirect (never bounce to an
 * unvalidated URI). Requires the user's Supabase session (else → login with a
 * `from` return). Trusted first-party clients with a remembered grant skip the
 * screen; everyone else approves the requested scopes here.
 */
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { OAUTH_PATHS, OAUTH_SCOPES, parseAndValidateScopes } from '@/lib/oauth/config';
import {
  getClient,
  clientAllowsRedirect,
  effectiveScopes,
  hasRememberedGrant,
  recordGrant,
  createAuthCode,
} from '@/services/auth/oauthProvider';
import { ConsentForm } from './ConsentForm';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

type SearchParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}

function appendParams(base: string, params: Record<string, string>): string {
  const url = new URL(base);
  for (const [k, v] of Object.entries(params)) {
    if (v) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const clientId = one(sp.client_id);
  const redirectUri = one(sp.redirect_uri);
  const responseType = one(sp.response_type);
  const scopeStr = one(sp.scope);
  const state = one(sp.state);
  const codeChallenge = one(sp.code_challenge);
  const codeChallengeMethod = one(sp.code_challenge_method) || 'S256';
  const nonce = one(sp.nonce);

  // 1) Validate client + redirect FIRST — these gate whether we may redirect at all.
  const client = clientId ? await getClient(clientId) : null;
  if (!client || !clientAllowsRedirect(client, redirectUri)) {
    return (
      <ErrorPanel
        title="This app can't sign you in"
        detail="The application is unknown, disabled, or its return URL isn't registered. Nothing was shared."
      />
    );
  }

  // 2) Past this point, errors can safely go back to the client's redirect_uri.
  if (responseType !== 'code') {
    redirect(appendParams(redirectUri, { error: 'unsupported_response_type', state }));
  }
  if (!codeChallenge || codeChallengeMethod !== 'S256') {
    redirect(appendParams(redirectUri, { error: 'invalid_request', state }));
  }

  const { granted } = parseAndValidateScopes(scopeStr);
  const scopes = effectiveScopes(client, granted);
  if (scopes.length === 0) {
    redirect(appendParams(redirectUri, { error: 'invalid_scope', state }));
  }

  // 3) Require a logged-in OrangeCat user; otherwise log in and come back here.
  const {
    data: { user },
  } = await (await createServerClient()).auth.getUser();
  if (!user) {
    const returnTo = `${OAUTH_PATHS.authorize}?${new URLSearchParams(
      Object.entries({
        response_type: responseType,
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
        nonce,
      }).filter(([, v]) => v) as [string, string][]
    ).toString()}`;
    redirect(authLoginPath(returnTo));
  }

  // 4) Trusted client + remembered grant → skip the screen, mint + redirect.
  if (client.is_trusted && (await hasRememberedGrant(user!.id, clientId, scopes))) {
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
    redirect(appendParams(redirectUri, { code, state }));
  }

  // 5) Show consent.
  const scopeRows = scopes.map(name => ({
    name,
    description: OAUTH_SCOPES.find(s => s.name === name)?.description ?? name,
  }));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <ConsentForm
        clientName={client.name}
        scopes={scopeRows}
        hidden={{
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: scopes.join(' '),
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          nonce,
        }}
      />
    </div>
  );
}

function ErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12 text-center">
      <h1 className="text-xl font-semibold text-fg-primary">{title}</h1>
      <p className="mt-3 text-sm text-fg-secondary">{detail}</p>
    </div>
  );
}
