/**
 * Where money paid to me lands — the signed-in person's own rule.
 *
 * GET  /api/money-routes  the rule, each line's progress, and the wallet the
 *                         next payment will land in
 * PUT  /api/money-routes  replace the rule with an ordered list
 *
 * Thin: the shape lives in @/domain/money-routes/schema, the I/O and the
 * decision in the domain, and RLS decides whose rows and wallets these are.
 */
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { DATABASE_TABLES } from '@/config/database-tables';
import { moneyRulesInputSchema } from '@/domain/money-routes/schema';
import { getRouteOverview, saveMoneyRules } from '@/domain/money-routes/service';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';

/** The caller's active personal wallets — the only wallets a rule may name. */
async function personalWalletIds(client: AnySupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client
    .from(DATABASE_TABLES.WALLETS)
    .select('id')
    .eq('profile_id', userId)
    .eq('is_active', true);
  if (error) {
    throw new Error(`wallets: ${error.message}`);
  }
  return ((data as Array<{ id: string }> | null) ?? []).map(w => w.id);
}

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const wallets = await personalWalletIds(req.supabase, req.user.id);
    return apiSuccess(await getRouteOverview(req.supabase, req.user.id, wallets));
  } catch (error) {
    logger.error('Money routes GET failed', { error }, 'MoneyRoutes');
    return handleApiError(error);
  }
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const rl = await rateLimitWriteAsync(req.user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const parsed = moneyRulesInputSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return apiBadRequest('Invalid rule', parsed.error.flatten());
    }
    const wallets = await personalWalletIds(req.supabase, req.user.id);
    const foreign = parsed.data.lines.filter(l => !wallets.includes(l.walletId));
    if (foreign.length > 0) {
      // Clearer than RLS's refusal, and checked before anything is written.
      return apiBadRequest('A rule can only name your own active wallets.', {
        walletIds: foreign.map(l => l.walletId),
      });
    }
    await saveMoneyRules(req.supabase, req.user.id, parsed.data);
    return apiSuccess(await getRouteOverview(req.supabase, req.user.id, wallets));
  } catch (error) {
    logger.error('Money routes PUT failed', { error }, 'MoneyRoutes');
    return handleApiError(error);
  }
});
