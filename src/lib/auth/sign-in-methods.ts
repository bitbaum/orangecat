/**
 * The ways into an account, and the one rule about removing them.
 *
 * An OrangeCat account signs in through its identities at the auth server:
 * `email` (password and the emailed code), one per linked provider (Google,
 * GitHub, X…), and, separately, any passkeys. Losing the inbox is survivable
 * only when at least one other way in exists, so this module is what the
 * settings card and the recovery page reason with. Pure; no client here.
 */
import { OAUTH_TO_SUPABASE, type OAuthProvider } from '@/app/auth/oauth-provider-map';

export interface SignInMethod {
  /** Identity id at the auth server (what unlink takes). */
  id: string;
  /** GoTrue provider key: `email`, `google`, `github`, `twitter`, … */
  provider: string;
  /** App-level provider id when it is one of ours (X is `twitter` upstream). */
  oauthProvider: OAuthProvider | null;
  /** The address or account name the provider knows the person by, if any. */
  handle: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

interface IdentityLike {
  identity_id: string;
  provider: string;
  identity_data?: Record<string, unknown>;
  created_at?: string;
  last_sign_in_at?: string;
}

const SUPABASE_TO_OAUTH = Object.fromEntries(
  Object.entries(OAUTH_TO_SUPABASE).map(([app, sb]) => [sb, app])
) as Record<string, OAuthProvider>;

export function describeIdentity(identity: IdentityLike): SignInMethod {
  const data = identity.identity_data ?? {};
  const handle =
    typeof data.email === 'string'
      ? data.email
      : typeof data.user_name === 'string'
        ? data.user_name
        : typeof data.preferred_username === 'string'
          ? data.preferred_username
          : null;
  return {
    id: identity.identity_id,
    provider: identity.provider,
    oauthProvider: SUPABASE_TO_OAUTH[identity.provider] ?? null,
    handle,
    createdAt: identity.created_at ?? null,
    lastSignInAt: identity.last_sign_in_at ?? null,
  };
}

/** Human label for a method: "Email", "Google", "X"… */
export function methodLabel(method: SignInMethod, providerNames: Record<string, string>): string {
  if (method.provider === 'email') {
    return 'Email';
  }
  return (
    (method.oauthProvider && providerNames[method.oauthProvider]) ??
    method.provider.charAt(0).toUpperCase() + method.provider.slice(1)
  );
}

/**
 * Why a method cannot be removed right now, or null if it can. An account
 * must keep at least one way in; a passkey counts as one. The auth server
 * enforces "at least two identities" itself, but says so only after the
 * click; this lets the card say it before.
 */
export function unlinkBlocker(
  method: SignInMethod,
  methods: SignInMethod[],
  passkeyCount: number
): string | null {
  const others = methods.filter(m => m.id !== method.id);
  if (others.length === 0 && passkeyCount === 0) {
    return 'This is the only way into your account. Add another before removing it.';
  }
  if (method.provider === 'email' && others.length === 0) {
    return 'Keep your email while it is the only sign-in besides a passkey: it is how you recover a lost device.';
  }
  return null;
}

/** Providers that could still be linked: ours, minus the ones already present. */
export function linkableProviders(
  methods: SignInMethod[],
  available: OAuthProvider[]
): OAuthProvider[] {
  const linked = new Set(methods.map(m => m.oauthProvider).filter(Boolean));
  return available.filter(p => !linked.has(p));
}
