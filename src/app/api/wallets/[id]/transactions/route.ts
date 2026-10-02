/**
 * Wallet On-Chain Transactions API
 *
 * GET /api/wallets/[id]/transactions — recent on-chain history for a wallet.
 *
 * Owner-only, and server-side on purpose: mempool.space must never be called
 * from the browser, which would hand every visitor's IP and the owner's
 * addresses to a third party. Publishing an address's history is a separate
 * decision from showing it to its owner, so this route deliberately does NOT
 * serve other people's wallets.
 */

import { logger } from '@/utils/logger';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { fetchWalletAndVerifyOwner } from '@/domain/wallets/updateWallet';
import { fetchWalletTransactions } from '@/domain/wallets/onchainTransactions';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** On-chain history only exists for wallets that are an address or a key. */
const ONCHAIN_TYPES = new Set(['address', 'xpub']);

export const GET = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'wallet ID'));
  if (idValidation) {
    return idValidation;
  }

  try {
    const { user, supabase } = request;

    // One owner test for every wallet route (fetchWalletAndVerifyOwner). The
    // check this replaced compared wallet.user_id alone, which refused a
    // project wallet's history to the person who owns the project.
    const owner = await fetchWalletAndVerifyOwner(supabase, id, user.id, 'view transactions for');
    if (owner.error) {
      return owner.error;
    }
    const wallet = owner.wallet;
    if (!ONCHAIN_TYPES.has(wallet.wallet_type ?? '') || !wallet.address_or_xpub) {
      // Lightning wallets have no chain history — say so rather than returning
      // an empty list, which reads as "no transactions yet".
      return apiBadRequest('This wallet has no on-chain history — it is not an address or key');
    }

    const transactions = await fetchWalletTransactions(wallet.wallet_type!, wallet.address_or_xpub);
    return apiSuccess({ transactions }, { cache: 'SHORT' });
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'RATE_LIMITED') {
      return apiRateLimited('Blockchain API rate limited. Please wait and try again.', 300);
    }
    // Never fall through to an empty list: "no transactions" and "we could not
    // look" must not render identically.
    logger.error('Failed to fetch on-chain transactions', { walletId: id, error: message });
    return apiInternalError('Could not read transactions from the blockchain', { status: 502 });
  }
});
