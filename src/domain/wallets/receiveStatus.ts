/**
 * Owner-facing receive status — "what would actually happen if someone paid me
 * right now", answered by the SAME resolution the payer's request runs.
 *
 * Why this exists: the wallets page used to infer capability from field
 * presence in the client (`has an nwc_connection_uri` ⇒ "your Lightning address
 * works"). That is a different question from the one the payment path asks, and
 * the two silently disagreed in production: a stored NWC URI that this
 * deployment cannot decrypt resolves to the on-chain rail, which cannot serve a
 * Lightning address at all. The page claimed "share it anywhere" while
 * /.well-known/lnurlp/<username> returned an error.
 *
 * So: one authority (`resolveUserWallet` + `isLightningCapable`), consumed by
 * both the public LNURL endpoint and the owner's page. They cannot diverge.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { isLightningCapable } from '@/domain/lightning-address/lnurl-service';
import { canDecrypt } from '@/domain/payments/encryptionService';
import type { ResolvedWallet } from '@/domain/payments/types';

export interface OwnerReceiveStatus {
  /** The rail a payer is actually given today. null = cannot receive at all. */
  rail: ResolvedWallet['method'] | null;
  /** Whether <username>@domain can mint invoices — same predicate as LNURL. */
  lightningAddressActive: boolean;
  /**
   * Wallets holding an NWC connection this deployment cannot use. Their owner
   * believes they are set up for Lightning; the payment path silently skips
   * them. Surfaced so the UI can say "reconnect" instead of "auto-receive".
   */
  unusableConnectionWalletIds: string[];
  /**
   * The wallet a payment actually settles into, when we can name it.
   * A Lightning address the owner pasted, or a static on-chain address.
   * Never a connection secret, and never an address derived from the username.
   */
  arrivesAt: string | null;
}

/**
 * Resolve the honest receive status for a user. Never throws — on failure it
 * reports the most conservative answer (cannot receive), because claiming a
 * working payment rail we could not verify is the failure mode this module
 * exists to prevent.
 */
export async function getOwnerReceiveStatus(userId: string): Promise<OwnerReceiveStatus> {
  const admin = getAdminClient() as unknown as SupabaseClient;

  const [wallet, unusableConnectionWalletIds] = await Promise.all([
    resolveUserWallet(admin, userId).catch(() => null),
    findUnusableConnections(admin, userId),
  ]);

  return {
    rail: wallet?.method ?? null,
    lightningAddressActive: isLightningCapable(wallet),
    unusableConnectionWalletIds,
    arrivesAt: publicDestination(wallet),
  };
}

/** Where the coins land. An extended public key is not itself an address. */
function publicDestination(wallet: ResolvedWallet | null): string | null {
  if (!wallet) {
    return null;
  }
  if (wallet.lightning_address) {
    return wallet.lightning_address;
  }
  if (wallet.onchain_address) {
    return wallet.onchain_address;
  }
  return null;
}

/**
 * Probe each active wallet's stored NWC URI. Mirrors the filter
 * `resolveUserWallet` uses, so "unusable" here means exactly "the payment path
 * will skip this". Decryption happens server-side and the plaintext is dropped
 * immediately — it is never returned or logged.
 */
async function findUnusableConnections(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await admin
    .from(DATABASE_TABLES.WALLETS)
    .select('id, nwc_connection_uri')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .not('nwc_connection_uri', 'is', null);

  const rows = (data ?? []) as Array<{ id: string; nwc_connection_uri: string | null }>;
  return rows.filter(row => !canDecrypt(row.nwc_connection_uri)).map(row => row.id);
}
