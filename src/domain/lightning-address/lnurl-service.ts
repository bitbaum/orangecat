/**
 * Lightning Address (LUD-16) for every OrangeCat user: `<username>@orangecat.ch`.
 *
 * NON-CUSTODIAL by construction. OrangeCat only serves the LNURL-pay discovery
 * document and, on the callback, asks the user's OWN connected wallet to mint an
 * invoice (NWC `make_invoice`, or a proxied request to their existing Lightning-
 * address provider — see invoiceGenerationService). The sats settle straight to
 * the user; OrangeCat never holds, routes, or touches funds — so there is no
 * custody, no money-transmitter/VASP status, and nothing for an attacker to
 * drain. The address is just a memorable pointer to a wallet the user controls.
 *
 * On-chain-only users can't have a Lightning address (it's a Lightning rail) and
 * resolve to null here.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { HandleLookupError, resolveHistoricalUsername } from './username-history';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import type { ResolvedWallet } from '@/domain/payments/types';

/** LNURL amount bounds, in millisats. min = 1 sat, max = 1 BTC. */
export const LNURL_MIN_SENDABLE_MSAT = 1_000;
export const LNURL_MAX_SENDABLE_MSAT = 100_000_000_000;

export interface LnurlRecipient {
  userId: string;
  username: string;
  displayName: string;
}

function admin(): SupabaseClient {
  return getAdminClient() as unknown as SupabaseClient;
}

/**
 * Resolve a username (case-insensitive) to its owner, or null if unknown.
 * Throws HandleLookupError when the lookup could not be made: null means the
 * database answered and nobody has, or had, the name.
 */
export async function resolveLnurlRecipient(username: string): Promise<LnurlRecipient | null> {
  const handle = username.trim();
  if (!handle) {
    return null;
  }
  // username_lower is a generated column (20260826120000), so this is an exact
  // match on the canonical form. It replaces `ilike`, which treats `_` as a
  // single-character wildcard — and `_` is a legal username character. Now that
  // every newly minted handle is shaped `user_<hex>`, an ilike lookup for
  // `user_823e4d9d2714` would also match `userX823e4d9d2714`. This lookup
  // decides which wallet a payment settles into; it cannot be approximate.
  const { data, error } = await admin()
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, display_name:name')
    .eq('username_lower', handle.toLowerCase())
    .maybeSingle();
  if (error) {
    throw new HandleLookupError(error.message);
  }

  const row = data as { id?: string; username?: string; display_name?: string } | null;
  if (row?.id && row.username) {
    return {
      userId: row.id,
      username: row.username,
      displayName: row.display_name || row.username,
    };
  }

  // Not a current handle. It may be one this profile used to have: a Lightning
  // address someone saved has no expiry, so a rename must not turn their next
  // payment into "no such recipient".
  const historicalId = await resolveHistoricalUsername(admin(), handle);
  if (!historicalId) {
    return null;
  }
  const { data: current, error: currentError } = await admin()
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, display_name:name')
    .eq('id', historicalId)
    .maybeSingle();
  if (currentError) {
    throw new HandleLookupError(currentError.message);
  }

  const owner = current as { id?: string; username?: string; display_name?: string } | null;
  if (!owner?.id || !owner.username) {
    return null;
  }
  return {
    userId: owner.id,
    username: owner.username,
    displayName: owner.display_name || owner.username,
  };
}

/**
 * The wallet a Lightning-address payment settles into. Only Lightning-capable
 * rails (NWC / Lightning address) qualify — an on-chain-only user cannot serve a
 * Lightning address, and returns null.
 */
export async function resolveLnurlWallet(userId: string): Promise<ResolvedWallet | null> {
  const wallet = await resolveUserWallet(admin(), userId);
  return isLightningCapable(wallet) ? wallet : null;
}

/**
 * THE rule for "can this resolved wallet serve a Lightning address" — exported
 * so owner-facing UI can answer the question with the exact predicate the
 * public LNURL endpoint uses, instead of guessing from field presence. If these
 * ever diverge, the wallet page starts lying about whether payments work.
 */
export function isLightningCapable(wallet: ResolvedWallet | null): boolean {
  return !!wallet && wallet.method !== 'onchain';
}

/** LUD-06/16 metadata array (stringified) shown by the payer's wallet. */
export function buildLnurlMetadata(recipient: LnurlRecipient, domain: string): string {
  return JSON.stringify([
    ['text/plain', `Pay ${recipient.displayName} on OrangeCat`],
    ['text/identifier', `${recipient.username}@${domain}`],
  ]);
}
