import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  apiInternalError,
  apiBadRequest,
  apiCreated,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getGroup } from '@/services/groups/queries/groups';
import { getGroupProposals, type ProposalStatus } from '@/services/groups/queries/proposals';
import { createProposal } from '@/services/groups/mutations/proposals';
import { recordGroupActivity } from '@/services/groups/activities';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';

const createProposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  proposal_type: z.string().max(50).optional(),
  action_type: z.string().max(50).optional(),
  action_data: z.record(z.string(), z.unknown()).optional(),
  voting_threshold: z.number().int().min(1).max(100).optional(),
  voting_starts_at: z.string().datetime({ offset: true }).optional(),
  voting_ends_at: z.string().datetime({ offset: true }).optional(),
  is_public: z.boolean().optional(),
});

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  try {
    const { slug } = await context.params;
    const { user } = request;
    const { searchParams } = request.nextUrl;
    const status = (searchParams.get('status') || 'all') as ProposalStatus | 'all';
    const proposalType = searchParams.get('proposal_type') || undefined;
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10))
    );
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    const groupResult = await getGroup(slug, true);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    // Access control: If not public, require auth+membership
    if (!groupResult.group.is_public && !user) {
      return apiUnauthorized();
    }

    const result = await getGroupProposals(groupResult.group.id, {
      status,
      proposal_type: proposalType,
      limit,
      offset,
    });

    if (!result.success) {
      return apiInternalError(result.error);
    }

    return apiSuccess({ proposals: result.proposals, total: result.total });
  } catch (error) {
    logger.error('Error in GET /api/groups/[slug]/proposals', error, 'API');
    return handleApiError(error);
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  try {
    const { slug } = await context.params;
    const { user } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      const retryAfter = retryAfterSeconds(rl);
      return apiRateLimited('Too many proposal requests. Please slow down.', retryAfter);
    }

    const groupResult = await getGroup(slug, true);
    if (!groupResult.success || !groupResult.group) {
      return apiNotFound('Group not found');
    }

    const body = await request.json();
    const parsed = createProposalSchema.safeParse(body);
    if (!parsed.success) {
      return apiBadRequest(parsed.error.issues[0]?.message || 'Invalid proposal data');
    }
    const result = await createProposal(
      { group_id: groupResult.group.id, ...parsed.data },
      request.supabase
    );

    if (!result.success) {
      return apiBadRequest(result.error);
    }

    // Await so the activity row is persisted (and errors surface) before
    // responding. Fire-and-forget was silently dropping the row.
    try {
      await recordGroupActivity(request.supabase, {
        group_id: groupResult.group.id,
        user_id: user.id,
        activity_type: 'created_proposal',
        metadata: { title: parsed.data.title, proposal_id: result.proposal?.id },
      });
    } catch (activityError) {
      logger.error('Failed to record proposal activity', activityError, 'API');
    }

    return apiCreated(result.proposal);
  } catch (error) {
    logger.error('Error in POST /api/groups/[slug]/proposals', error, 'API');
    return handleApiError(error);
  }
});
