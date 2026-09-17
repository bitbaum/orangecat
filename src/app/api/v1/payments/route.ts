/**
 * POST /api/v1/payments — Initiate a payment (machine-payable contract)
 *
 * The authenticated buy half of the agent loop: discover (GET /api/v1/<entity>,
 * /api/v1/search) → pay (here: creates a payment intent + Lightning invoice)
 * → verify (GET /api/v1/payments/{id} until status=paid).
 *
 * Accepts integration keys (`payments.write` scope) and session auth — same
 * dual-auth contract as the rest of /api/v1. For the account-less flow use
 * POST /api/v1/payments/public instead.
 */

import { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  apiSuccess,
  apiBadRequest,
  apiUnauthorized,
  apiForbidden,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
} from '@/lib/api/standardResponse';
import { resolveRequestAuth, hasScope } from '@/lib/api/resolveRequestAuth';
import { initiatePayment } from '@/domain/payments';
import { mapKnownPaymentError } from '@/domain/payments/knownPaymentErrors';
import { paymentCreateSchema } from '@/lib/validation/finance';
import { getEntityMetadata } from '@/config/entity-registry';
import { createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createPublicClient } from '@/lib/supabase/public';
import { looseClient } from '@/lib/supabase/untyped';
import {
  rateLimitWriteAsync,
  rateLimitIntegrationKeyWrite,
  retryAfterSeconds,
} from '@/lib/rate-limit';
import { logger } from '@/utils/logger';

const PAYMENTS_WRITE_SCOPE = 'payments.write';

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveRequestAuth(request);
    if (!auth) {
      return apiUnauthorized();
    }
    if (!hasScope(auth.scopes, PAYMENTS_WRITE_SCOPE)) {
      logger.warn('Scope denied for payments.write', {
        userId: auth.userId,
        source: auth.source,
        integrationKeyId: auth.integrationKeyId,
      });
      return apiForbidden('This key is not allowed to initiate payments.');
    }

    const rl =
      auth.source === 'integration_key' && auth.integrationKeyId
        ? await rateLimitIntegrationKeyWrite(auth.integrationKeyId)
        : await rateLimitWriteAsync(auth.userId);
    if (!rl.success) {
      return apiRateLimited('Too many payment requests. Please slow down.', retryAfterSeconds(rl));
    }

    const body = await request.json();
    const result = paymentCreateSchema.safeParse(body);
    if (!result.success) {
      return apiBadRequest('Invalid input', result.error.issues);
    }
    const validated = result.data;

    // Session callers read through their own RLS (public rows + own rows).
    // Key/OIDC callers carry no Supabase session, so writes go through the
    // service-role client (authz enforced above — the entityPostHandler
    // pattern). To keep visibility semantics equivalent, gate on the entity
    // being anonymously readable first: a key can only pay for public listings.
    let supabase: SupabaseClient;
    if (auth.source === 'session') {
      supabase = (await createServerClient()) as unknown as SupabaseClient;
    } else {
      const meta = getEntityMetadata(validated.entity_type);
      // Table name comes from the registry at runtime.
      const { data: visibleEntity } = await looseClient(createPublicClient())
        .from(meta.tableName)
        .select('id')
        .eq('id', validated.entity_id)
        .maybeSingle();
      if (!visibleEntity) {
        return apiNotFound('Entity not found');
      }
      supabase = createAdminClient() as unknown as SupabaseClient;
    }

    const paymentResult = await initiatePayment(supabase, auth.userId, {
      entity_type: validated.entity_type,
      entity_id: validated.entity_id,
      amount_btc: validated.amount_btc,
      message: validated.message,
      is_anonymous: validated.is_anonymous,
      shipping_address_id: validated.shipping_address_id,
      buyer_note: validated.buyer_note,
    });

    return apiSuccess(paymentResult, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment initiation failed';
    logger.error('v1 payment initiation failed', { error });

    const safeMessage = mapKnownPaymentError(message);
    if (safeMessage) {
      return apiBadRequest(safeMessage);
    }
    return apiInternalError('Failed to initiate payment');
  }
}
