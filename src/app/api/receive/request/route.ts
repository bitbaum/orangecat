/**
 * POST /api/receive/request { amount_btc, wallet_id? } — owner-side "get paid".
 *
 * Mints an exact-amount payment request against the AUTHENTICATED user's own
 * wallet (a specific one when wallet_id is given, else the same primary-first
 * resolution every payer gets). It is the tips engine pointed at yourself:
 * an entity-less payment_intent riding the shared invoice + settle path, so
 * the owner gets live "paid" feedback and the standard settle notification.
 * Non-custodial: the QR pays straight into their wallet.
 */

import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { RECEIVE_MIN_BTC, RECEIVE_MAX_BTC } from '@/config/receive';
import {
  resolveUserWallet,
  resolveSpecificUserWallet,
} from '@/domain/payments/walletResolutionService';
import { initiateTip } from '@/domain/payments/paymentFlowService';
import { logger } from '@/utils/logger';

const bodySchema = z.object({
  amount_btc: z.number().positive().min(RECEIVE_MIN_BTC).max(RECEIVE_MAX_BTC),
  wallet_id: z.string().guid().optional(),
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many payment requests. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return apiBadRequest('Invalid request', parsed.error.flatten());
    }

    const admin = getAdminClient() as unknown as SupabaseClient;

    // Wallet resolution runs on the admin client (secrets are server-only);
    // resolveSpecificUserWallet scopes by profile_id, so a wallet id belonging
    // to someone else resolves to null instead of a payable rail.
    const wallet = parsed.data.wallet_id
      ? await resolveSpecificUserWallet(admin, user.id, parsed.data.wallet_id)
      : await resolveUserWallet(admin, user.id);
    if (!wallet) {
      return apiBadRequest(
        parsed.data.wallet_id
          ? 'That wallet cannot receive payments.'
          : 'Connect a wallet before receiving payments.'
      );
    }

    const { data: profile } = await admin
      .from(DATABASE_TABLES.PROFILES)
      .select('username, display_name:name')
      .eq('id', user.id)
      .maybeSingle();
    const row = profile as { username?: string | null; display_name?: string | null } | null;
    const recipientName = row?.display_name || row?.username || 'you';

    const res = await initiateTip({
      recipientUserId: user.id,
      recipientName,
      wallet,
      amountBtc: parsed.data.amount_btc,
    });

    return apiSuccess({
      intentId: res.payment_intent.id,
      statusToken: res.status_token,
      qrData: res.qr_data,
      methodLabel: res.method_label,
      amountBtc: parsed.data.amount_btc,
      expiresInSeconds: res.expires_in_seconds,
      paymentMethod: res.payment_intent.payment_method,
    });
  } catch (error) {
    logger.error('receive/request failed', { error }, 'Receive');
    return apiInternalError('Could not create a payment request.');
  }
});
