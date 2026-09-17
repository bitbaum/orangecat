/**
 * POST /api/profile-claims — draft a profile for someone else, get back a
 *   claim link (/claim/[id]) to send them.
 * GET  /api/profile-claims — list the claims the caller has created.
 *
 * Thin HTTP layer — business rules live in @/domain/profileClaims/service.
 */

import { z } from 'zod';
import { usernameSchema, webUrl } from '@/lib/validation/base';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiCreated,
  apiSuccess,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { createProfileClaim } from '@/domain/profileClaims/service';
import { listProfileClaimsCreatedBy } from '@/domain/profileClaims/creator';
import { normalizeClaimDraft } from '@/domain/profileClaims/draft';
import { ROUTES } from '@/config/routes';

const socialLinkSchema = z.object({
  platform: z.string().trim().min(1).max(40),
  label: z.string().trim().max(60).optional(),
  value: z.string().trim().min(1).max(300),
});

const createClaimSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  bio: z.string().trim().max(1000).optional(),
  avatarUrl: webUrl({ max: 2000 }).optional(),
  bannerUrl: webUrl({ max: 2000 }).optional(),
  website: webUrl({ max: 2000 }).optional(),
  socialLinks: z.array(socialLinkSchema).max(10).optional(),
  // The shared schema, not a hand-rolled regex: a suggested username becomes a
  // real handle at claim time, and a handle is a Lightning address
  // (<username>@orangecat.ch). A local pattern here made this the one door into
  // `profiles.username` that skipped RESERVED_USERNAMES — `payments`,
  // `support`, `security` were all suggestible.
  suggestedUsername: usernameSchema.optional(),
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
    }

    const parsed = createClaimSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiValidationError('Invalid request', {
        fields: parsed.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    const { name, bio, avatarUrl, bannerUrl, website, socialLinks, suggestedUsername } =
      parsed.data;

    const result = await createProfileClaim({
      createdBy: user.id,
      draft: {
        kind: 'person',
        profile: { name, bio, avatarUrl, bannerUrl, website, socialLinks },
      },
      suggestedUsername,
    });

    if (!result.ok) {
      return handleApiError('dbError' in result ? result.dbError : result);
    }

    return apiCreated({
      id: result.data.id,
      // The link carries the TOKEN, never the row id — see ADR-0004 D4.
      claimUrl: ROUTES.CLAIM(result.data.token),
      // The placeholder actor: pass it as `actor_id` when creating what this
      // person will own, and the rows are theirs from the start (ADR-0005 D1).
      actorId: result.data.actorId,
      slug: result.data.slug,
      pageUrl: ROUTES.PROFILES.VIEW(result.data.slug),
    });
  } catch (error) {
    logger.error('profile-claims create failed', error, 'ProfileClaims');
    return handleApiError(error);
  }
});

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { user } = req;
    const result = await listProfileClaimsCreatedBy(user.id);
    if (!result.ok) {
      return handleApiError('dbError' in result ? result.dbError : result);
    }

    return apiSuccess({
      claims: result.data.map(claim => {
        // Rows predating the `{kind, profile}` shape carry a flat person draft.
        const draft = normalizeClaimDraft(claim.draft);
        return {
          id: claim.id,
          name: draft?.profile.name ?? 'Unnamed',
          status: claim.status,
          suggestedUsername: claim.suggested_username,
          claimUrl: ROUTES.CLAIM(claim.token),
          createdAt: claim.created_at,
          claimedAt: claim.claimed_at,
          expiresAt: claim.expires_at,
          // The funnel a creator actually needs: sent? opened? refused?
          deliveredAt: claim.delivered_at,
          firstViewedAt: claim.first_viewed_at,
          viewCount: claim.view_count,
          declinedAt: claim.declined_at,
        };
      }),
    });
  } catch (error) {
    logger.error('profile-claims list failed', error, 'ProfileClaims');
    return handleApiError(error);
  }
});
