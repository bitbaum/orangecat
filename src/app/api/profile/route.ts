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
    const { data: profile, error: profileError } = await ProfileServerService.getProfile(
      supabase,
      user.id
    );

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

    const { data: profile, error } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .update({ ...dataToSave, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      logger.error('Profile update failed', {
        userId: user.id,
        error: error.message,
        code: error.code,
      });
      return apiValidationError('Failed to update profile');
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
