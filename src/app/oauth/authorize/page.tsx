/**
 * OAuth2 / OIDC authorization endpoint (consent screen).
 *
 * GET /oauth/authorize?response_type=code&client_id&redirect_uri&scope&state
 *   &code_challenge&code_challenge_method=S256&nonce[&resource]
 *
 * `resource` (RFC 8707) binds the eventual access token to one of
 * OAUTH_RESOURCES — OrangeCat's MCP server or Loki's — and narrows (or, when no
 * scope was asked for, defaults) the scopes to that resource's.
 *
 * Validates the client + redirect BEFORE any redirect (never bounce to an
 * unvalidated URI). Requires the user's Supabase session (else → login with a
 * `from` return). Trusted first-party clients with a remembered grant skip the
 * screen; everyone else approves the requested scopes here.
 */
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import {
  OAUTH_CLIENT_ORIGINS,
  OAUTH_PATHS,
  OAUTH_SCOPES,
  findOAuthResource,
} from '@/lib/oauth/config';
import {
  getClient,
  clientAllowsRedirect,
  grantableScopes,
  hasRememberedGrant,
  recordGrant,
  createAuthCode,
} from '@/services/auth/oauthProvider';
import { authHandoffUrl } from '@/lib/oauth/handoff';
import { ConsentForm } from './ConsentForm';
import { AddEmailForm } from './AddEmailForm';

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
  const resourceParam = one(sp.resource);
  // What the person already chose on the relying party's own screen — see
  // src/lib/oauth/handoff.ts. Only used to shape the sign-in screen.
  const prompt = one(sp.prompt);
  const loginHint = one(sp.login_hint);
  const idpHint = one(sp.idp_hint);

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

  // RFC 8707 §2: a resource we don't issue tokens for is `invalid_target`.
  const resource = findOAuthResource(resourceParam);
  if (resourceParam && !resource) {
    redirect(appendParams(redirectUri, { error: 'invalid_target', state }));
  }

  const scopes = grantableScopes(client, scopeStr, resource);
  if (scopes.length === 0) {
    redirect(appendParams(redirectUri, { error: 'invalid_scope', state }));
  }

  // 3) Require a logged-in OrangeCat user; otherwise log in and come back here.
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        resource: resource?.uri ?? '',
      }).filter(([, v]) => v) as [string, string][]
    ).toString()}`;
    redirect(authHandoffUrl({ returnTo, prompt, loginHint, idpHint, clientId }));
  }

  // 3.5) Anonymous accounts add an email first. Federating an identity with no
  // email would hand relying parties (Loki, Solon) an unattributable account,
  // so it is asked for here, once, on the same screen — never a dead end.
  if (user.is_anonymous) {
    const returnTo = `${OAUTH_PATHS.authorize}?${new URLSearchParams(
      Object.entries(sp).map(([k, v]) => [k, one(v)]) as [string, string][]
    ).toString()}`;
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <AddEmailForm clientName={client.name} returnTo={returnTo} />
      </div>
    );
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
      resource: resource?.uri ?? null,
    });
    redirect(appendParams(redirectUri, { code, state }));
  }

  // 5) Show consent — as which account, so a person signed in as the wrong
  // one sees it before allowing, not after.
  const { data: profile } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('username, name')
    .eq('id', user!.id)
    .maybeSingle<{ username: string | null; name: string | null }>();

  const scopeRows = scopes.map(name => {
    const scope = OAUTH_SCOPES.find(s => s.name === name);
    return { name, description: scope?.description ?? name, sensitive: !!scope?.sensitive };
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <ConsentForm
        clientName={client.name}
        selfRegistered={client.registered_via === OAUTH_CLIENT_ORIGINS.dcr}
        redirectHost={new URL(redirectUri).host}
        account={{
          name: profile?.name ?? null,
          username: profile?.username ?? null,
          email: user!.email ?? null,
        }}
        policyUri={client.policy_uri ?? null}
        tosUri={client.tos_uri ?? null}
        resourceName={resource?.name ?? null}
        scopes={scopeRows}
        hidden={{
          client_id: clientId,
          redirect_uri: redirectUri,
          scope: scopes.join(' '),
          state,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          nonce,
          resource: resource?.uri ?? '',
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
