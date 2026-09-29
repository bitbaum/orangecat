/**
 * Research Entity Creation Domain Service
 *
 * Business logic for creating research entities, extracted from the API route.
 */

import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { apiRateLimited, apiSuccess } from '@/lib/api/standardResponse';
import { getTableName } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import type { ResearchEntityCreate } from '@/types/research';
import { commitPreregistration, decidePreregistration } from './openScience';
import type { NextResponse } from 'next/server';

const MAX_RESEARCH_PER_USER = 10;

interface CreateResearchResult {
  response: NextResponse<any>;
}

export async function createResearch(
  supabase: SupabaseClient,
  userId: string,
  validatedData: ResearchEntityCreate
): Promise<CreateResearchResult> {
  // Enforce per-user limit
  const tableName = getTableName('research');
  const { count, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (countError) {
    throw countError;
  }

  if (count && count >= MAX_RESEARCH_PER_USER) {
    return {
      response: apiRateLimited(
        'Maximum 10 research entities per user. Please complete or archive existing projects.',
        3600
      ),
    };
  }

  const fundingGoalBtc =
    (validatedData as { funding_goal_btc?: number }).funding_goal_btc || 0.00001;

  // research_entities.actor_id is NOT NULL — an insert without it violates the
  // constraint. Dual-write user_id + actor_id like ai_assistants does.
  const actor = await getOrCreateUserActor(userId);
  const prereg = decidePreregistration(
    validatedData.preregistration as string | null | undefined,
    null
  );

  const insertData = {
    user_id: userId,
    actor_id: actor.id,
    title: validatedData.title,
    description: validatedData.description,
    field: validatedData.field,
    methodology: validatedData.methodology,
    expected_outcome: validatedData.expected_outcome,
    timeline: validatedData.timeline,
    funding_goal_btc: fundingGoalBtc,
    funding_raised_btc: 0,
    funding_model: validatedData.funding_model,
    wallet_address: null,
    lead_researcher: validatedData.lead_researcher,
    team_members: validatedData.team_members || [],
    open_collaboration: validatedData.open_collaboration ?? true,
    resource_needs: validatedData.resource_needs || [],
    progress_frequency: validatedData.progress_frequency,
    transparency_level: validatedData.transparency_level,
    voting_enabled: validatedData.voting_enabled ?? true,
    impact_areas: validatedData.impact_areas || [],
    target_audience: validatedData.target_audience || [],
    sdg_alignment: validatedData.sdg_alignment || [],
    status: STATUS.RESEARCH.DRAFT,
    is_public: validatedData.is_public ?? true,
    is_featured: false,
    license: validatedData.license ?? null,
    output_links: validatedData.output_links ?? [],
    ...(prereg.kind === 'commit' ? await commitPreregistration(prereg.text) : {}),
    // Denormalized counter columns (citation_count, follower_count, …) were
    // dropped in migration 20260404000005 — inserting them breaks live.
  };

  logger.info('Attempting to create research entity', {
    tableName,
    userId,
    insertData: JSON.stringify(insertData),
  });

  // Verify the user has a profile (required for FK constraint)
  const { data: profileData, error: profileError } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id')
    .eq('id', userId)
    .single();

  logger.info('Profile check result', {
    hasProfile: !!profileData,
    profileError: profileError ? JSON.stringify(profileError) : null,
  });

  if (profileError || !profileData) {
    logger.error('User profile not found - cannot create research entity', {
      userId,
      profileError: profileError?.message,
    });
    throw new Error('User profile not found. Please complete your profile setup first.');
  }

  // Insert with detailed error logging retained for diagnosis
  try {
    const response = await fromTable(supabase, tableName).insert(insertData).select().single();

    const { data: researchEntity, error, status, statusText } = response;

    logger.info('Supabase insert result', {
      hasData: !!researchEntity,
      hasError: !!error,
      status,
      statusText,
      dataKeys: researchEntity ? Object.keys(researchEntity) : [],
      errorMessage: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint,
      errorKeys: error ? Object.keys(error) : [],
      errorProto: error ? Object.getPrototypeOf(error)?.constructor?.name : null,
    });

    if (error || status >= 400) {
      logger.error('Research entity creation failed', {
        userId,
        status,
        statusText,
        error: error?.message,
        errorCode: error?.code,
        errorDetails: error?.details,
        errorHint: error?.hint,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error || {})),
      });
      throw new Error(
        error?.message || `Database error (status ${status}): ${statusText || 'Unknown error'}`
      );
    }

    logger.info('Research entity created successfully', {
      researchEntityId: researchEntity.id,
      userId,
    });

    return { response: apiSuccess(researchEntity, { status: 201 }) };
  } catch (insertError) {
    logger.error('Supabase insert threw exception', {
      message: (insertError as Error).message,
      name: (insertError as Error).name,
      stack: (insertError as Error).stack,
    });
    throw insertError;
  }
}
