/**
 * Group Invitations API — thin HTTP layer; business rules live in
 * @/domain/groups/invitations.server.
 *
 * GET  /api/groups/[slug]/invitations - List invitations (admin only)
 * POST /api/groups/[slug]/invitations - Create invitation (admin only)
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiCreated,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import {
  listGroupInvitations,
  authorizeGroupInvitationCreate,
  createGroupInvitation,
  type InvitationCollectionResult,
} from '@/domain/groups/invitations.server';

const createInvitationSchema = z
  .object({
    user_id: z.string().guid().optional(),
    email: z.string().email().optional(),
    create_link: z.boolean().optional(),
    role: z.enum(['admin', 'member']).optional().default('member'),
    message: z.string().max(500).optional(),
    expires_in_days: z.number().int().min(1).max(30).optional().default(7),
  })
  .refine(data => data.user_id || data.email || data.create_link, {
    message: 'Must provide user_id, email, or create_link',
  });

/** Map a failed domain result onto the matching HTTP error response. */
function toErrorResponse(result: Extract<InvitationCollectionResult<unknown>, { ok: false }>) {
  if ('dbError' in result) {
    return handleApiError(result.dbError);
  }
  switch (result.code) {
    case 'not_found':
      return apiNotFound(result.message);
    case 'forbidden':
      return apiForbidden(result.message);
    default:
      return apiValidationError(result.message);
  }
}

export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { user, supabase } = req;
      const { searchParams } = new URL(req.url);

      const result = await listGroupInvitations(supabase, slug, user.id, {
        status: searchParams.get('status'),
        limit: searchParams.get('limit'),
        offset: searchParams.get('offset'),
      });
      if (!result.ok) {
        return toErrorResponse(result);
      }
      return apiSuccess(result.data);
    } catch (error) {
      logger.error('Invitations GET error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);

export const POST = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { user, supabase } = req;

      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const authz = await authorizeGroupInvitationCreate(supabase, slug, user.id);
      if (!authz.ok) {
        return toErrorResponse(authz);
      }

      const validation = createInvitationSchema.safeParse(await req.json());
      if (!validation.success) {
        return apiValidationError('Invalid request data', validation.error.flatten());
      }

      const result = await createGroupInvitation(
        supabase,
        authz.data.groupId,
        user.id,
        validation.data
      );
      if (!result.ok) {
        return toErrorResponse(result);
      }
      return apiCreated(result.data);
    } catch (error) {
      logger.error('Invitations POST error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);
