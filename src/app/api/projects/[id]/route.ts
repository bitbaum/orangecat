import { projectSchema } from '@/lib/validation';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { logger } from '@/utils/logger';
import { createEntityCrudHandlers } from '@/lib/api/entityCrudHandler';
import {
  createUpdatePayloadBuilder,
  commonFieldMappings,
  entityTransforms,
} from '@/lib/api/buildUpdatePayload';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';
import { getCacheControl } from '@/lib/api/helpers';

// Post-process GET: Fetch profile and add to response
async function postProcessProjectGet(
  project: Record<string, unknown>,
  _userId: string | null,
  supabase: SupabaseClient
): Promise<Record<string, unknown>> {
  let profile = null;
  const projectActorId = project.actor_id as string | undefined;
  const projectUserId = project.user_id as string | undefined;

  // Try to resolve profile via actor_id first, fall back to legacy user_id
  let profileUserId: string | undefined;
  if (projectActorId) {
    // Look up the actor's user_id to find the profile
    const { data: actorData } = await supabase
      .from(DATABASE_TABLES.ACTORS)
      .select('user_id')
      .eq('id', projectActorId)
      .maybeSingle();
    if (actorData?.user_id) {
      profileUserId = actorData.user_id as string;
    }
  }
  // Fall back to legacy user_id if actor lookup didn't yield a result
  if (!profileUserId && projectUserId) {
    profileUserId = projectUserId;
  }

  if (profileUserId) {
    const { data: profileData, error: profileError } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      // No `email`: this GET is unauthenticated and publicly cacheable, so it
      // put the creator's login email in a shared cache, and no consumer read
      // it. anon has no SELECT on it either now (migration 20260917120100).
      .select('id, username, name, avatar_url')
      .eq('id', profileUserId)
      .maybeSingle();

    if (profileError) {
      logger.warn(
        'Error fetching profile for project',
        {
          projectId: project.id,
          userId: profileUserId,
          error: profileError,
        },
        'GET /api/projects/[id]'
      );
    } else if (profileData) {
      profile = profileData;
    } else {
      logger.warn(
        'Profile not found for project creator',
        {
          projectId: project.id,
          userId: profileUserId,
        },
        'GET /api/projects/[id]'
      );
    }
  }

  // Honest funding figures from the settled ledger — the raised_amount column
  // is dead, so API consumers would otherwise see 0 regardless of funding.
  const [enriched] = await enrichProjectsWithSettledFunding(supabase, [
    project as { id: string; currency?: string | null },
  ]);

  return {
    ...(enriched ?? project),
    profiles: profile,
  };
}

// Post-process PUT: Audit logging
async function postProcessProjectPut(
  project: Record<string, unknown>,
  userId: string,
  _supabase: SupabaseClient
): Promise<void> {
  await auditSuccess(AUDIT_ACTIONS.PROJECT_CREATED, userId, 'project', project.id as string, {
    action: 'update',
    updatedFields: Object.keys(project),
    title: project.title as string,
  });
}

// Post-process DELETE: Audit logging
async function postProcessProjectDelete(
  project: Record<string, unknown>,
  userId: string,
  _supabase: SupabaseClient
): Promise<void> {
  await auditSuccess(AUDIT_ACTIONS.PROJECT_CREATED, userId, 'project', project.id as string, {
    action: 'delete',
    title: project.title as string,
    category: project.category as string,
  });
}

// Build update payload from validated project data
const buildProjectUpdatePayload = createUpdatePayloadBuilder([
  { from: 'title' },
  { from: 'description', transform: entityTransforms.emptyStringToNull },
  { from: 'goal_amount' },
  // Currency: only include if explicitly provided (don't override existing value)
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
  { from: 'funding_purpose', transform: entityTransforms.emptyStringToNull },
  { from: 'work_status', transform: entityTransforms.emptyStringToNull },
  { from: 'bitcoin_address', transform: entityTransforms.emptyStringToNull },
  { from: 'lightning_address', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.urlField('website_url'),
  { from: 'category', transform: entityTransforms.emptyStringToNull },
  commonFieldMappings.arrayField('tags', []),
  commonFieldMappings.dateField('start_date'), // Normalize date fields
  commonFieldMappings.dateField('target_completion'),
  { from: 'show_on_profile' },
]);

// Create handlers using generic CRUD factory
const { GET, PUT, DELETE } = createEntityCrudHandlers({
  entityType: 'project',
  schema: projectSchema,
  buildUpdatePayload: buildProjectUpdatePayload,
  ownershipField: 'actor_id',
  useActorOwnership: true,
  requireActiveStatus: false, // Projects don't have status field
  postProcessGet: postProcessProjectGet,
  postProcessPut: postProcessProjectPut,
  postProcessDelete: postProcessProjectDelete,
  getCacheControl: () => getCacheControl(false),
});

export { GET, PUT, DELETE };
