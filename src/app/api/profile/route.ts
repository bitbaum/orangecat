import { profileSchema, normalizeProfileData, PROFILE_UPDATABLE_FIELDS } from '@/lib/validation';
import {
  apiSuccess,
  apiNotFound,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { ProfileServerService } from '@/services/profile/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Fields safe to persist — guards against schema/validation drift
// Writable columns come from the schema (PROFILE_UPDATABLE_FIELDS) — never a
// hand-written list here. The old local copy drifted and silently dropped
// currency, background, and inspiration_statement from every save.

async function respondWithProfile(
  supabase: AnySupabaseClient,
  user: User,
  profile: ProfileRow,
  request: AuthenticatedRequest
) {
  const includeStats = request.nextUrl.searchParams.get('include_stats') === 'true';
  if (includeStats) {
    const projectCount = await ProfileServerService.getProjectCount(supabase, user.id);
    return apiSuccess({ ...profile, project_count: projectCount }, { cache: 'SHORT' });
  }
  return apiSuccess(profile, { cache: 'SHORT' });
}

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;
    const { data: profile, error: profileError } =
      await ProfileServerService.getOwnProfile(supabase);

    if (profileError || !profile) {
      const { data: bootstrapped, error: ensureError } = await ProfileServerService.ensureProfile(
        supabase,
        user.id,
        user.email,
        user.user_metadata
      );
      if (ensureError || !bootstrapped) {
        return apiNotFound('Profile not found');
      }
      return respondWithProfile(supabase, user, bootstrapped, request);
    }

    return respondWithProfile(supabase, user, profile, request);
  } catch (error) {
    return handleApiError(error);
  }
});

export const PUT = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { user, supabase } = request;

    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited(
        'Too many profile update requests. Please slow down.',
        retryAfterSeconds(rl)
      );
    }

    const body = await request.json();
    logger.info('Profile update request', { userId: user.id, fields: Object.keys(body) });

    if (body.username) {
      const isAvailable = await ProfileServerService.checkUsernameAvailability(
        supabase,
        body.username,
        user.id
      );
      if (!isAvailable) {
        logger.warn('Username already taken', { username: body.username, userId: user.id });
        return apiValidationError('Username is already taken', { field: 'username' });
      }
    }

    const validatedData = profileSchema.parse(normalizeProfileData(body));

    const dataToSave = Object.fromEntries(
      Object.entries(validatedData as Record<string, unknown>).filter(([key]) =>
        PROFILE_UPDATABLE_FIELDS.includes(key)
      )
    );

    // Write to the TABLE — RLS `profiles_update_own` is what confines this to
    // the caller's own row — but do not ask for the row back in the same
    // statement. A bare `.select()` is `RETURNING *`, which needs SELECT on
    // every column returned, and `authenticated` holds none on email / phone /
    // contact_email (20260917163100). Read the saved row back through the
    // owner-scoped view instead, so the response body is unchanged.
    const { error } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .update({ ...dataToSave, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      logger.error('Profile update failed', {
        userId: user.id,
        error: error.message,
        code: error.code,
      });
      return apiValidationError('Failed to update profile');
    }

    const { data: profile, error: readBackError } =
      await ProfileServerService.getOwnProfile(supabase);
    if (readBackError || !profile) {
      // The save itself succeeded; only the read-back failed. Say so rather
      // than reporting a validation error the user could act on.
      logger.error('Profile saved but could not be read back', {
        userId: user.id,
        error: readBackError?.message,
      });
      return handleApiError(readBackError ?? new Error('Profile read-back failed'));
    }

    logger.info('Profile updated successfully', { userId: user.id });
    return apiSuccess(profile);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      interface ZodIssue {
        path?: (string | number)[];
        message?: string;
      }
      const firstIssue = (error as Error & { issues?: ZodIssue[] }).issues?.[0];
      return apiValidationError(
        `${firstIssue?.path?.join('.') || 'field'}: ${firstIssue?.message || 'Invalid profile data'}`
      );
    }
    logger.error('Profile update error', { error });
    return handleApiError(error);
  }
});
