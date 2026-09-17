/**
 * Wallet by ID API Routes
 *
 * PATCH  /api/wallets/[id] - Update a wallet
 * DELETE /api/wallets/[id] - Soft-delete a wallet
 */

import { logger } from '@/utils/logger';
import { handleSupabaseError } from '@/lib/wallets/errorHandling';
import {
  apiSuccess,
  apiInternalError,
  apiBadRequest,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { DATABASE_TABLES, WALLET_CLIENT_COLUMNS } from '@/config/database-tables';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { walletUpdateSchema } from '@/lib/validation/finance';
import {
  fetchWalletAndVerifyOwner,
  buildWalletUpdates,
  enforceSinglePrimary,
} from '@/domain/wallets/updateWallet';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PATCH /api/wallets/[id] - Update wallet
export const PATCH = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const idValidation = getValidationError(validateUUID(id, 'wallet ID'));
    if (idValidation) {
      return idValidation;
    }

    const { user, supabase } = request;

    const rlUpdate = await rateLimitWriteAsync(user.id);
    if (!rlUpdate.success) {
      return apiRateLimited(
        'Too many wallet update requests. Please slow down.',
        retryAfterSeconds(rlUpdate)
      );
    }

    const rawBody = await request.json();
    const parseResult = walletUpdateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return apiBadRequest('Invalid input', parseResult.error.issues);
    }

    const result = await fetchWalletAndVerifyOwner(supabase, id, user.id, 'update');
    if (result.error) {
      return result.error;
    }
    const { wallet } = result;

    const updateResult = buildWalletUpdates(parseResult.data);
    if (updateResult.error) {
      return updateResult.error;
    }
    const { updates } = updateResult;

    if (parseResult.data.is_primary === true) {
      await enforceSinglePrimary(supabase, wallet, id);
    }

    const { data: updatedWallet, error: updateError } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .update(updates)
      .eq('id', id)
      .select(WALLET_CLIENT_COLUMNS)
      .single();

    if (updateError) {
      logger.error('Failed to update wallet', { walletId: id, error: updateError.message });
      return handleSupabaseError('update wallet', updateError, { walletId: id });
    }

    await auditSuccess(AUDIT_ACTIONS.WALLET_UPDATED, user.id, 'wallet', id, {
      updatedFields: Object.keys(updates),
      category: updates.category || wallet.category,
    });

    logger.info('Wallet updated successfully', { walletId: id, userId: user.id });
    return apiSuccess(updatedWallet);
  } catch (error) {
    logger.error('Unexpected error updating wallet', { error });
    return apiInternalError('Failed to update wallet');
  }
});

// DELETE /api/wallets/[id] - Soft-delete wallet
export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const idValidation = getValidationError(validateUUID(id, 'wallet ID'));
    if (idValidation) {
      return idValidation;
    }

    const { user, supabase } = request;

    const rlDelete = await rateLimitWriteAsync(user.id);
    if (!rlDelete.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rlDelete));
    }

    const result = await fetchWalletAndVerifyOwner(supabase, id, user.id, 'delete');
    if (result.error) {
      return result.error;
    }
    const { wallet } = result;

    // is_primary is cleared with the same write. A soft delete used to leave the
    // flag standing, and enforceSinglePrimary only ever sweeps ACTIVE rows — so a
    // deactivated wallet stayed "primary" permanently, out of reach of every later
    // correction. Production accumulated four such rows while the live wallets were
    // not primary at all, and "the primary wallet" resolved to a deleted one. A
    // partial unique index now backs this up; keeping the two in step is the point.
    const { error: deleteError } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .update({ is_active: false, is_primary: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) {
      logger.error('Failed to delete wallet', { walletId: id, error: deleteError.message });
      return handleSupabaseError('delete wallet', deleteError, { walletId: id });
    }

    await auditSuccess(AUDIT_ACTIONS.WALLET_DELETED, user.id, 'wallet', id, {
      category: wallet.category,
      entityType: wallet.profile_id ? 'profile' : 'project',
      entityId: wallet.profile_id || wallet.project_id,
    });

    logger.info('Wallet deleted successfully', { walletId: id, userId: user.id });
    return apiSuccess({ success: true, message: 'Wallet deleted successfully' });
  } catch (error) {
    logger.error('Unexpected error deleting wallet', { error });
    return apiInternalError('Failed to delete wallet');
  }
});
