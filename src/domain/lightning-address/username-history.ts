/**
 * Resolving a handle a profile no longer uses.
 *
 * A username here is a public profile URL AND a Lightning address
 * (`<username>@orangecat.ch`). So when an account is renamed — which the fleet
 * has to do for the 77 profiles still publishing their email local part — every
 * saved payment address and inbound link pointing at the old handle would
 * silently stop working. Silently: a wallet gets "no such recipient", nobody
 * gets an error report, and the money simply does not arrive.
 *
 * profile_username_history keeps the old handle resolving forever, so a rename
 * changes what a profile is CALLED without changing what can still find it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The handle lookup itself failed (database unreachable, query refused).
 *
 * Thrown, never folded into "not found": the lookup decides whether a pay page
 * exists and which wallet a payment settles into. Answering a database hiccup
 * with "no such person" told a payer's wallet the recipient did not exist and
 * served a 404 for a real page (seen in CI against the live database,
 * 2026-11-12: /pay/<name> answered 404 once, then 200).
 */
export class HandleLookupError extends Error {
  constructor(detail: string) {
    super(`Handle lookup failed: ${detail}`);
    this.name = 'HandleLookupError';
  }
}

/**
 * The profile id a retired handle used to belong to, or null.
 *
 * Goes through an RPC rather than a PostgREST filter. PostgREST reads `+` in a
 * query string as a space and supabase-js sends the character raw, so
 * `.eq('old_username', 'butaeff+ocauth2')` searched for "butaeff ocauth2" and
 * found nothing — measured against production, on two live profiles whose
 * legacy handles contain '+'. For those the profile redirect 404'd and a
 * Lightning payment could not find its owner, which is the precise failure
 * this table exists to prevent.
 *
 * An RPC argument travels in a JSON body, so nothing needs escaping and no
 * future handle can be mangled by the transport. The function lowercases and
 * trims server-side, so callers cannot drift from the stored form either.
 */
export async function resolveHistoricalUsername(
  client: SupabaseClient,
  handle: string
): Promise<string | null> {
  const trimmed = handle.trim();
  if (!trimmed) {
    return null;
  }
  const { data, error } = await client.rpc('resolve_username_history', { handle: trimmed });
  if (error) {
    // "We could not look" is not "nobody ever had this name": see
    // HandleLookupError in lnurl-service.
    throw new HandleLookupError(error.message);
  }
  return typeof data === 'string' && data ? data : null;
}
