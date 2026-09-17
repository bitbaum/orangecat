/**
 * Wallets API - List and Create
 *
 * GET  /api/wallets?profile_id=xxx  - List wallets for a profile or project
 * POST /api/wallets                 - Create a new wallet
 */

import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { handleSupabaseError } from '@/lib/wallets/errorHandling';
import { applyRateLimitHeaders, rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { apiSuccess, apiRateLimited } from '@/lib/api/standardResponse';
import { validateOneOfIds, getValidationError } from '@/lib/api/validation';
import { getTableName } from '@/config/entity-registry';
import { WALLET_CLIENT_COLUMNS } from '@/config/database-tables';
import { readPublicWallets } from '@/services/wallets/publicWalletRead';
import { createWallet } from '@/domain/wallets/createWallet';

// What a non-owner may see — the curated field list, the is_active filter and
// extended-key redaction — moved to services/wallets/publicWalletRead, which is
// now the ONE definition. `address_or_xpub` holds two very different things: a
// plain address is meant to be shared, while an extended public key is the key
// every address is derived FROM, and publishing one hands any visitor a
// wallet's entire past and future address set. This listing served real zpubs
// to anonymous callers once (#743); the public wallet page needs the identical
// read, so the rule got a home rather than a second copy.

// GET /api/wallets?profile_id=xxx OR ?project_id=xxx
export const GET = withOptionalAuth(async request => {
  try {
    const { user, supabase } = request;
    const searchParams = request.nextUrl.searchParams;
    const profileId = searchParams.get('profile_id');
    const projectId = searchParams.get('project_id');

    const idValidation = validateOneOfIds(
      { profile_id: profileId, project_id: projectId },
      'profile_id or project_id is required'
    );
    const validationError = getValidationError(idValidation);
    if (validationError) {
      return validationError;
    }

    const isOwner = user ? isProfileOwner(user, profileId) : false;

    // Wallet rows are owner-readable only at the RLS level, so a non-owner is
    // served through a service-role read with a CURATED field list and
    // extended-key redaction. That combination now lives in one place —
    // services/wallets/publicWalletRead — because the public wallet PAGE needs
    // exactly the same read, and a second copy of this rule is how an xpub
    // reached anonymous callers the first time (#743).
    if (!isOwner) {
      const rows = await readPublicWallets(
        profileId ? { profileId } : { projectId: projectId as string }
      );
      return apiSuccess(rows, { cache: 'SHORT' });
    }

    let query = supabase
      .from(getTableName('wallet'))
      .select(WALLET_CLIENT_COLUMNS)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (profileId) {
      query = query.eq('profile_id', profileId);
    } else if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch wallets', {
        profileId,
        projectId,
        error: error.message,
        code: error.code,
      });
      return handleSupabaseError('fetch wallets', error, { profileId, projectId });
    }

    // Only the owner reaches here — the non-owner path returned above, already
    // curated and redacted. The owner sees their own key, which is the whole
    // point of owning it.
    return apiSuccess(data || [], { cache: 'SHORT' });
  } catch (error) {
    logger.error('Unexpected error in GET /api/wallets', { error });
    return handleSupabaseError('fetch wallets', error);
  }
});

function isProfileOwner(user: User, profileId: string | null): boolean {
  // Profile.id IS the auth user_id — direct comparison is safe
  return profileId !== null && profileId === user.id;
}

// POST /api/wallets - Create new wallet
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rateLimitResult = await rateLimitWriteAsync(user.id);
    if (!rateLimitResult.success) {
      return apiRateLimited(
        'Too many wallet creation requests. Please slow down.',
        retryAfterSeconds(rateLimitResult)
      );
    }

    // Malformed JSON becomes null → walletCreateSchema (the validation SSOT,
    // applied inside createWallet) rejects it with a 400 instead of a 500.
    const rawBody = await request.json().catch(() => null);
    const { response } = await createWallet(supabase, user, rawBody);
    return applyRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    return handleSupabaseError('create wallet', error);
  }
});
