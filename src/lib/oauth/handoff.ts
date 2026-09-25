/**
 * The hand-off from /oauth/authorize to the sign-in screen, and back.
 *
 * A person creating "a Solon account" never has to go to OrangeCat first: the
 * relying party asks for what the person already chose on its own screen, and
 * OrangeCat's /auth opens in that state. The requests are standard OIDC where a
 * standard exists and one widely used extension where it does not:
 *
 *   prompt=create   → open on "Create account" (OIDC Prompt Create 1.0)
 *   login_hint      → pre-fill the email (OIDC Core §3.1.2.1)
 *   idp_hint        → go straight to Google/GitHub/… (Keycloak's name for it)
 *
 * The client id rides along so the screen can say who is asking — resolved
 * server-side against oauth_clients, never shown from the URL as-is.
 *
 * Every value here arrives in a URL anyone can craft, so each is validated
 * and anything unexpected is dropped rather than echoed.
 */
import { isOAuthProvider, type OAuthProvider } from '@/app/auth/oauth-provider-map';

export interface AuthHandoff {
  /** Where to go once signed in — a same-origin path. */
  from: string;
  mode?: 'register';
  email?: string;
  provider?: OAuthProvider;
  client?: string;
}

// Deliberately loose: the sign-in form validates properly; this only keeps
// markup-ish junk out of a pre-filled input.
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,255}$/;
const CLIENT_ID = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

/** A same-origin path, or null. `from` is attacker-suppliable. */
export function safeReturnPath(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}

/** Build the /auth URL for someone who reached /oauth/authorize signed out. */
export function authHandoffUrl(input: {
  returnTo: string;
  prompt?: string;
  loginHint?: string;
  idpHint?: string;
  clientId?: string;
}): string {
  const params = new URLSearchParams({ from: input.returnTo });
  // `prompt` is a space-separated list per OIDC Core.
  if (input.prompt?.split(' ').includes('create')) {
    params.set('mode', 'register');
  }
  if (input.loginHint && EMAIL.test(input.loginHint)) {
    params.set('email', input.loginHint);
  }
  if (input.idpHint && isOAuthProvider(input.idpHint)) {
    params.set('provider', input.idpHint);
  }
  if (input.clientId && CLIENT_ID.test(input.clientId)) {
    params.set('client', input.clientId);
  }
  return `/auth?${params.toString()}`;
}

/** Read the hand-off back on /auth, dropping anything that fails validation. */
export function readHandoff(params: { get(name: string): string | null }): AuthHandoff {
  const email = params.get('email');
  const provider = params.get('provider');
  const client = params.get('client');
  return {
    from: safeReturnPath(params.get('from')) ?? '/dashboard',
    ...(params.get('mode') === 'register' ? { mode: 'register' as const } : {}),
    ...(email && EMAIL.test(email) ? { email } : {}),
    ...(provider && isOAuthProvider(provider) ? { provider } : {}),
    ...(client && CLIENT_ID.test(client) ? { client } : {}),
  };
}

/**
 * Where GoTrue should send someone after Google/GitHub/an email link: back
 * through our callback, carrying the return path. Without `next` the callback
 * falls back to OrangeCat's own welcome page, and a person who started on
 * Solon never gets back to Solon.
 */
export function callbackUrl(origin: string, from: string | null): string {
  const next = safeReturnPath(from);
  return next
    ? `${origin}/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/auth/callback`;
}
