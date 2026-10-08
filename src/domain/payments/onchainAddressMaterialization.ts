/**
 * A payable, never-reused on-chain address for one invoice.
 *
 * Kept apart from wallet RESOLUTION (walletResolutionService), which decides
 * which wallet and rail receive a payment and backs read-only surfaces too.
 * This is the one step that WRITES — it claims a derivation index — so it runs
 * at invoice creation and nowhere else.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase/admin';
import { deriveOnchainAddress } from './addressDerivation';
import type { ResolvedWallet } from './types';
import { logger } from '@/utils/logger';

/**
 * Turn a resolved on-chain wallet into one carrying a concrete, payable,
 * NEVER-REUSED address. Call this at invoice creation — and only there.
 *
 * For an xpub wallet this atomically claims the next derivation index
 * (`allocate_derivation_index`, service-role RPC) and derives external-chain
 * address 0/index. Uniqueness per intent is what makes on-chain settlement
 * detection sound: (address, amount, window) matching can only be trusted when
 * nobody else ever pays that address — the reused-address false-settle of
 * 2026-07-31 is the counterexample.
 *
 * Throws rather than degrades: an invoice we cannot mint an address for must
 * fail loudly, not fall back to something unpayable or ambiguous.
 */
export async function materializeOnchainAddress(wallet: ResolvedWallet): Promise<ResolvedWallet> {
  if (wallet.method !== 'onchain' || wallet.onchain_address) {
    return wallet;
  }
  if (!wallet.onchain_xpub) {
    throw new Error('On-chain wallet has neither an address nor an extended public key');
  }

  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data: index, error } = await admin.rpc('allocate_derivation_index', {
    p_wallet_id: wallet.wallet_id,
  });
  if (error || typeof index !== 'number') {
    logger.error('Failed to allocate derivation index', { walletId: wallet.wallet_id, error });
    throw new Error('Failed to allocate a receiving address');
  }

  const address = deriveOnchainAddress(wallet.onchain_xpub, index);
  logger.info(
    'Derived per-invoice on-chain address',
    { walletId: wallet.wallet_id, index },
    'addressDerivation'
  );
  return { ...wallet, onchain_address: address };
}
