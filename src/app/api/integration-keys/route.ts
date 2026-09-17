/**
 * Integration keys — mint and list.
 *
 * GET  /api/integration-keys           → list caller's keys (no plaintext)
 * POST /api/integration-keys           → mint a new key, plaintext returned ONCE
 *
 * Auth: Supabase session only. Integration keys themselves cannot mint
 * further keys — that would let a leaked key escalate by issuing fresh
 * ones immune to the original key's revocation.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { compose } from '@/lib/api/compose';
import { withRequestId } from '@/lib/api/withRequestId';
import { withZodBody } from '@/lib/api/withZod';
import { createServerClient } from '@/lib/supabase/server';
import {
  apiSuccess,
  apiUnauthorized,
  apiForbidden,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import {
  createIntegrationKey,
  listIntegrationKeys,
  ActorNotPermittedError,
} from '@/services/auth/integrationKeys';

const createKeySchema = z.object({
  name: z.string().min(1).max(120),
  actor_id: z.string().guid(),
  /** Optional scopes allowlist. Omit (or pass ['*']) for full authority.
   *  Token format `<entity>.<read|write>` (e.g. 'products.write'). */
  scopes: z.array(z.string().min(1).max(80)).max(40).optional(),
  /** Sandbox key. Plaintext is `ock_test_<hex>` instead of `ock_<hex>`;
   *  entities created via this key are stamped is_test=true and only
   *  visible via sandbox keys. Default false. */
  is_test: z.boolean().optional(),
});

async function requireSessionUser(): Promise<{ id: string } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export const GET = compose(withRequestId())(async () => {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return apiUnauthorized();
    }
    const keys = await listIntegrationKeys(user.id);
    return apiSuccess({ keys });
  } catch (error) {
    return handleApiError(error);
  }
});

export const POST = compose(
  withRequestId(),
  withZodBody(createKeySchema)
)(async (_req: NextRequest, ctx) => {
  try {
    const user = await requireSessionUser();
    if (!user) {
      return apiUnauthorized();
    }
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }
    const { name, actor_id, scopes, is_test } = ctx.body as {
      name: string;
      actor_id: string;
      scopes?: string[];
      is_test?: boolean;
    };
    try {
      const minted = await createIntegrationKey({
        userId: user.id,
        actorId: actor_id,
        name,
        scopes,
        isTest: is_test,
      });
      return apiSuccess({ key: minted.key, plaintext: minted.plaintext }, { status: 201 });
    } catch (error) {
      if (error instanceof ActorNotPermittedError) {
        return apiForbidden('You are not permitted to mint a key for this actor.');
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
});
