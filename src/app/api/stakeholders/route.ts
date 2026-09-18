/**
 * Stakeholder Relationships API
 *
 * Typed edges between projects and the eight stakeholder categories
 * (competitor / collaborator / investor / customer / employee /
 * acquirer / acquisition_target / in_house_dev) — the cross-product
 * stakeholder graph documented in the Thoughts essay "Where
 * Stakeholders Live". OrangeCat stores the graph, Loki reads it.
 *
 * GET    /api/stakeholders?fromProjectId=<uuid>&kind=<kind>
 *        — list relationships for a project (and optionally filter by kind).
 * POST   /api/stakeholders
 *        — create a new typed edge from the caller's project to a
 *          stakeholder. Stakeholder target is one of: another actor,
 *          another project, or an external URL.
 *
 * Integration clients should use GET/POST /api/v1/stakeholders with
 * stakeholders.read / stakeholders.write scopes instead.
 *
 * Backed by the stakeholder_relationships table — see migration
 * 20260601000000_create_stakeholder_relationships.sql. RLS in the
 * database is the authoritative ownership check; the validation here
 * is defence in depth.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiCreated,
  apiBadRequest,
  apiValidationError,
  apiNotFound,
  apiInternalError,
  apiRateLimited,
  apiUnauthorized,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { createStakeholderSchema } from '@/config/stakeholders';
import {
  listStakeholderRelationships,
  createStakeholderRelationship,
} from '@/services/platform/stakeholderRelationships';
import { getUserActorId } from '@/domain/actors';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { supabase } = request;
    const url = new URL(request.url);
    const fromProjectId = url.searchParams.get('fromProjectId');
    const kindFilter = url.searchParams.get('kind') ?? undefined;

    if (!fromProjectId) {
      return apiBadRequest('fromProjectId query parameter is required');
    }

    const result = await listStakeholderRelationships(supabase, fromProjectId, kindFilter);
    if (!result.ok) {
      if (result.reason === 'bad_kind') {
        return apiBadRequest(result.message);
      }
      return apiInternalError(result.message);
    }

    return apiSuccess({ relationships: result.relationships });
  } catch (error) {
    logger.error('Unexpected error in GET /api/stakeholders', error, 'StakeholdersAPI');
    return apiInternalError('Internal server error');
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiBadRequest('Invalid JSON body');
    }

    const parsed = createStakeholderSchema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError('Invalid request', parsed.error.flatten());
    }

    const actorId = await getUserActorId(supabase, user.id);
    if (!actorId) {
      logger.error('No actor found for authenticated user', { userId: user.id }, 'StakeholdersAPI');
      return apiUnauthorized('No actor associated with this user');
    }
    const actorRow = { id: actorId };
    const ownerActorId = actorRow.id as string;

    const result = await createStakeholderRelationship(supabase, ownerActorId, parsed.data);
    if (!result.ok) {
      switch (result.reason) {
        case 'project_not_found':
          return apiNotFound(result.message);
        case 'forbidden':
          return apiUnauthorized(result.message);
        default:
          return apiInternalError(result.message);
      }
    }

    return apiCreated({ relationship: result.relationship });
  } catch (error) {
    logger.error('Unexpected error in POST /api/stakeholders', error, 'StakeholdersAPI');
    return apiInternalError('Internal server error');
  }
});
