/**
 * Project Balance Refresh API
 *
 * POST /api/projects/[id]/refresh-balance - Refresh project Bitcoin balance
 */

import { fetchAddressBalance } from '@/lib/bitcoin/addressBalance';
import {
  apiSuccess,
  apiForbidden,
  apiNotFound,
  apiBadRequest,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { logger } from '@/utils/logger';
import { getTableName } from '@/config/entity-registry';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id: projectId } = await context.params;
    const idValidation = getValidationError(validateUUID(projectId, 'project ID'));
    if (idValidation) {
      return idValidation;
    }

    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const { data: project, error } = await supabase
      .from(getTableName('project'))
      .select(
        'id, user_id, bitcoin_address, bitcoin_balance_btc, bitcoin_balance_updated_at, title'
      )
      .eq('id', projectId)
      .single();

    if (error || !project) {
      return apiNotFound('Project not found');
    }
    if (user.id !== project.user_id) {
      return apiForbidden('You can only refresh balance for your own projects');
    }
    if (!project.bitcoin_address) {
      return apiBadRequest('No Bitcoin address configured for this project');
    }

    if (project.bitcoin_balance_updated_at) {
      const secondsAgo =
        (Date.now() - new Date(project.bitcoin_balance_updated_at).getTime()) / 1000;
      if (secondsAgo < 1) {
        return apiSuccess(
          {
            balance_btc: project.bitcoin_balance_btc,
            updated_at: project.bitcoin_balance_updated_at,
            cached: true,
          },
          { status: 202 }
        );
      }
      const minutesAgo = secondsAgo / 60;
      if (minutesAgo < 5) {
        const wait = Math.ceil(5 - minutesAgo);
        return apiRateLimited(`Please wait ${wait} more minute${wait > 1 ? 's' : ''}`, wait * 60);
      }
    }

    let balance;
    try {
      balance = await fetchAddressBalance(project.bitcoin_address);
    } catch (err) {
      logger.error('Failed to fetch Bitcoin balance', {
        projectId,
        error: err instanceof Error ? err.message : err,
      });
      return apiInternalError('Failed to fetch balance from blockchain');
    }

    const { error: updateError } = await supabase
      .from(getTableName('project'))
      .update({
        bitcoin_balance_btc: balance.balance_btc,
        bitcoin_balance_updated_at: balance.updated_at,
      })
      .eq('id', projectId);

    if (updateError) {
      logger.error('Failed to update project balance', { projectId, error: updateError.message });
      return apiInternalError('Failed to update project balance');
    }

    await auditSuccess(AUDIT_ACTIONS.PROJECT_CREATED, user.id, 'project', projectId, {
      action: 'balance_refresh',
      previousBalance: project.bitcoin_balance_btc,
      newBalance: balance.balance_btc,
    });

    return apiSuccess({
      balance_btc: balance.balance_btc,
      tx_count: balance.tx_count,
      updated_at: balance.updated_at,
    });
  } catch (error) {
    logger.error('Unexpected error refreshing project balance', { error });
    return apiInternalError('Failed to refresh balance');
  }
});
