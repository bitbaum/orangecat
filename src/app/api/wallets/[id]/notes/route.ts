/**
 * The owner's note on one transaction.
 *
 * GET    /api/wallets/[id]/notes  — every note on this wallet (owner only)
 * PUT    /api/wallets/[id]/notes  — { txid, note } upsert
 * DELETE /api/wallets/[id]/notes  — { txid }
 *
 * Ownership is checked with fetchWalletAndVerifyOwner, the same helper PATCH
 * and DELETE on the wallet itself use. The nearby transactions route rolls its
 * own `wallet.user_id !== user.id` check, which is why a project wallet's notes
 * would be refused to the very person who owns the project — one owner test,
 * not three.
 *
 * Writes go through the CALLER's client, so row-level security has the last
 * word even if this handler were wrong.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiBadRequest, apiRateLimited } from '@/lib/api/standardResponse';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { handleSupabaseError } from '@/lib/wallets/errorHandling';
import { fetchWalletAndVerifyOwner } from '@/domain/wallets/updateWallet';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/** A bitcoin txid is 32 bytes rendered as 64 lowercase hex characters. */
const TXID = /^[0-9a-f]{64}$/;
const MAX_NOTE = 500;

async function walletIdFrom(params: Promise<{ id: string }>): Promise<string> {
  return (await params).id;
}

export const GET = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    const { user, supabase } = request;
    const walletId = await walletIdFrom(context.params);

    const owner = await fetchWalletAndVerifyOwner(supabase, walletId, user.id, 'read notes for');
    if (owner.error) {
      return owner.error;
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
      .select('txid, note, updated_at')
      .eq('wallet_id', walletId);

    if (error) {
      return handleSupabaseError('read wallet notes', error, { walletId });
    }
    return apiSuccess({ notes: data ?? [] });
  }
);

export const PUT = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    const { user, supabase } = request;
    const walletId = await walletIdFrom(context.params);

    // A note is a write, and writes carry a quota — the same one wallet
    // creation uses. Without it, one account could hammer this endpoint into
    // the wallets table; api-route-guards fails any mutating route that omits it.
    const rateLimitResult = await rateLimitWriteAsync(user.id);
    if (!rateLimitResult.success) {
      return apiRateLimited(
        'Too many note updates. Please slow down.',
        retryAfterSeconds(rateLimitResult)
      );
    }

    const body = await request.json().catch(() => null);
    const txid = typeof body?.txid === 'string' ? body.txid.trim().toLowerCase() : '';
    const note = typeof body?.note === 'string' ? body.note.trim() : '';

    if (!TXID.test(txid)) {
      return apiBadRequest('txid must be 64 hexadecimal characters');
    }
    if (!note) {
      return apiBadRequest('A note cannot be empty — delete it instead');
    }
    if (note.length > MAX_NOTE) {
      return apiBadRequest(`A note is at most ${MAX_NOTE} characters`);
    }

    const owner = await fetchWalletAndVerifyOwner(supabase, walletId, user.id, 'annotate');
    if (owner.error) {
      return owner.error;
    }

    // One note per transaction: writing again corrects it rather than stacking
    // a second opinion under the same number.
    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
      .upsert(
        { wallet_id: walletId, txid, note, updated_at: new Date().toISOString() },
        { onConflict: 'wallet_id,txid' }
      )
      .select('txid, note, updated_at')
      .single();

    if (error) {
      logger.error('Failed to save wallet transaction note', { walletId, error: error.message });
      return handleSupabaseError('save wallet note', error, { walletId });
    }
    return applyRateLimitHeaders(apiSuccess({ note: data }), rateLimitResult);
  }
);

export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context: { params: Promise<{ id: string }> }) => {
    const { user, supabase } = request;
    const walletId = await walletIdFrom(context.params);

    const rateLimitResult = await rateLimitWriteAsync(user.id);
    if (!rateLimitResult.success) {
      return apiRateLimited(
        'Too many note updates. Please slow down.',
        retryAfterSeconds(rateLimitResult)
      );
    }

    const body = await request.json().catch(() => null);
    const txid = typeof body?.txid === 'string' ? body.txid.trim().toLowerCase() : '';
    if (!TXID.test(txid)) {
      return apiBadRequest('txid must be 64 hexadecimal characters');
    }

    const owner = await fetchWalletAndVerifyOwner(supabase, walletId, user.id, 'annotate');
    if (owner.error) {
      return owner.error;
    }

    const { error } = await supabase
      .from(DATABASE_TABLES.WALLET_TRANSACTION_NOTES)
      .delete()
      .eq('wallet_id', walletId)
      .eq('txid', txid);

    if (error) {
      return handleSupabaseError('delete wallet note', error, { walletId });
    }
    return applyRateLimitHeaders(apiSuccess({ deleted: true }), rateLimitResult);
  }
);
