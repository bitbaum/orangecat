/**
 * Are passkeys switched on at the auth server?
 *
 * GoTrue (self-hosted Supabase Auth) supports WebAuthn passkeys, but only when
 * the box sets GOTRUE_PASSKEY_ENABLED and the relying-party id/origins (see
 * docs/operations/passkeys.md). Until it does, every passkey call fails, so the
 * UI must not offer one: a "Sign in with a passkey" button that can never work
 * is a dead end. The flag is read from GoTrue's public settings document, the
 * same one the OAuth-provider list reads, and cached for five minutes.
 */
import { logger } from '@/utils/logger';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; enabled: boolean } | null = null;

/** Pure: what the settings document says. Anything but an explicit true is off. */
export function readPasskeysEnabled(settings: unknown): boolean {
  return (
    typeof settings === 'object' &&
    settings !== null &&
    (settings as { passkeys_enabled?: unknown }).passkeys_enabled === true
  );
}

/** Server-side: fail closed, cache briefly. */
export async function arePasskeysEnabled(): Promise<boolean> {
  if (!SUPABASE_URL || !ANON_KEY) {
    return false;
  }
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.enabled;
  }
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: ANON_KEY },
    });
    const enabled = res.ok && readPasskeysEnabled(await res.json());
    cache = { at: Date.now(), enabled };
    return enabled;
  } catch (error) {
    logger.warn('Could not read auth settings for passkeys; treating as off', { error }, 'Auth');
    // Do not cache a failure for the full window; try again soon.
    cache = { at: Date.now() - CACHE_TTL_MS + 30_000, enabled: false };
    return false;
  }
}
