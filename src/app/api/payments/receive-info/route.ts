/**
 * GET /api/payments/receive-info?entity_type=X&entity_id=Y
 *
 * Owner-facing: returns display-safe info about where an entity collects funds
 * (which payment method + a Lightning/on-chain address, never an NWC secret),
 * resolved via the SAME path the payment flow uses (SSOT). Gated to the entity
 * owner — buyers learn the address from the invoice, not from this endpoint.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiBadRequest,
  apiForbidden,
  apiInternalError,
} from '@/lib/api/standardResponse';
import { resolveSellerReceiveInfo, getSellerUserId } from '@/domain/payments';
import { ENTITY_TYPES, type EntityType } from '@/config/entity-registry';
import { logger } from '@/utils/logger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return apiBadRequest('entity_type and entity_id are required');
    }
    if (!UUID_REGEX.test(entityId)) {
      return apiBadRequest('entity_id must be a valid UUID');
    }
    if (!ENTITY_TYPES.includes(entityType as EntityType)) {
      return apiBadRequest(`entity_type must be one of: ${ENTITY_TYPES.join(', ')}`);
    }

    // Owner-only: the receiving address is the owner's to inspect.
    const sellerUserId = await getSellerUserId(supabase, entityType as EntityType, entityId);
    if (!sellerUserId || sellerUserId !== user.id) {
      return apiForbidden('Only the owner can view receiving info for this entity');
    }

    const info = await resolveSellerReceiveInfo(entityType as EntityType, entityId);

    return apiSuccess({
      hasWallet: !!info,
      method: info?.method ?? null,
      address: info?.address ?? null,
    });
  } catch (error) {
    logger.error('Failed to resolve receive info', { error });
    return apiInternalError('Failed to resolve receiving info');
  }
});
