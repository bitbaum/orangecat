/**
 * The one way a wallet is read for somebody who does not own it.
 *
 * Wallet rows are owner-only at the RLS level (`wallets_select_own`), and
 * `REVOKE SELECT ... FROM anon` means no browser and no anonymous server render
 * can reach them directly. That is deliberate: this table holds
 * `address_or_xpub`, and an extended public key published once exposes a
 * wallet's entire past and future address set forever. It was served to
 * anonymous callers before (#743), which is why the lockdown exists.
 *
 * So every public surface has to go through a service-role read with a curated
 * column list and redaction applied. That combination was written inline in
 * GET /api/wallets and was about to be written a second time for the public
 * wallet page — two copies of a rule whose first copy had already leaked once.
 * It lives here instead, and both callers import it.
 *
 * The rule, in full:
 *   - only `is_active` rows are public at all;
 *   - only PUBLIC_WALLET_FIELDS leave the server — no balance, no description,
 *     no goal, no `nwc_connection_uri` (the database will not even grant that
 *     column to client roles);
 *   - an extended public key is nulled by VALUE, never trusted to the
 *     user-settable `wallet_type` label.
 */

import { getAdminClient } from '@/lib/supabase/admin';
import { getTableName } from '@/config/entity-registry';
import { redactExtendedKeys } from '@/lib/wallets/publicWallet';

/**
 * Public wallet fields — safe to return without auth.
 *
 * Deliberately NOT here: `balance_btc` and `balance_updated_at` (what someone
 * holds is nobody else's business), `description`, `goal_amount` and the other
 * goal columns (a wallet labelled "medical costs" is the owner's to disclose,
 * not ours), and `nwc_connection_uri` (a secret). Anything added to this list
 * is a new public disclosure of financial data and should be treated as one.
 */
export const PUBLIC_WALLET_FIELDS =
  'id, address_or_xpub, wallet_type, label, category, category_icon, lightning_address, is_primary, display_order, profile_id, project_id, open_accounting';

/** Exactly the shape the public field list produces, after redaction. */
export interface PublicWallet {
  id: string;
  address_or_xpub: string | null;
  wallet_type: string | null;
  label: string | null;
  category: string | null;
  category_icon: string | null;
  lightning_address: string | null;
  is_primary: boolean | null;
  display_order: number | null;
  profile_id: string | null;
  project_id: string | null;
  /**
   * Whether this wallet publishes its ledger. The FLAG is public; the balance
   * and transactions it governs are not in this list and are read separately
   * by services/wallets/publicLedger, which re-checks the flag itself.
   */
  open_accounting: boolean | null;
}

type Scope = { profileId: string } | { projectId: string } | { walletId: string };

/**
 * Read active wallets for a profile, a project, or one wallet by id.
 *
 * Returns [] rather than throwing when the admin client is unavailable — a
 * missing service-role key must degrade to "no wallets shown", never to a
 * stack trace on a public page. `getAdminClient` returns a Proxy that throws on
 * property access, so the call is guarded.
 */
export async function readPublicWallets(scope: Scope): Promise<PublicWallet[]> {
  let db;
  try {
    db = getAdminClient();
  } catch {
    return [];
  }

  let query = db
    .from(getTableName('wallet'))
    .select(PUBLIC_WALLET_FIELDS)
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false });

  if ('profileId' in scope) {
    query = query.eq('profile_id', scope.profileId);
  } else if ('projectId' in scope) {
    query = query.eq('project_id', scope.projectId);
  } else {
    query = query.eq('id', scope.walletId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return redactExtendedKeys(data as unknown as Array<Record<string, unknown>>) as unknown as
    PublicWallet[];
}

/** One wallet by id, or null when it does not exist or is not active. */
export async function readPublicWallet(walletId: string): Promise<PublicWallet | null> {
  const rows = await readPublicWallets({ walletId });
  return rows[0] ?? null;
}
