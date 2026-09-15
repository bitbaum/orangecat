/**
 * Generic Profile Entity API Endpoint
 *
 * Fetches entities of any type for a user's profile page.
 * Respects show_on_profile and status filters.
 *
 * GET /api/profiles/[userId]/entities/[entityType]
 */

import { logger } from '@/utils/logger';
import { apiSuccess, apiInternalError, apiBadRequest } from '@/lib/api/standardResponse';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { validateUUID, getValidationError } from '@/lib/api/validation';
import {
  getTableName,
  getUserIdField,
  isValidEntityType,
  EntityType,
  getEntityMetadata,
} from '@/config/entity-registry';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { ENTITY_STATUS } from '@/config/database-constants';
import { enrichProjectsWithSettledFunding } from '@/services/wallets/project-funding';

// Entity-specific column selections for optimal queries
const ENTITY_COLUMNS: Record<EntityType, string> = {
  project:
    'id, title, description, category, tags, status, bitcoin_address, lightning_address, goal_amount, currency, raised_amount, created_at, updated_at',
  product: 'id, title, description, category, price, currency, status, images, created_at',
  service:
    'id, title, description, category, hourly_rate, fixed_price, currency, status, created_at',
  cause: 'id, title, description, goal_amount, currency, status, created_at',
  ai_assistant: 'id, title, description, category, pricing_model, status, avatar_url, created_at',
  asset:
    'id, title, description, type, estimated_value, currency, verification_status, status, created_at',
  loan: 'id, title, description, original_amount, remaining_balance, interest_rate, currency, status, created_at',
  investment:
    'id, title, description, investment_type, target_amount, minimum_investment, total_raised, currency, expected_return_rate, return_frequency, term_months, status, risk_level, created_at',
  event:
    'id, title, description, event_type, category, start_date, end_date, venue_name, venue_city, is_online, status, ticket_price, is_free, currency, created_at',
  wallet: 'id, label, wallet_type, address, is_active, created_at',
  group: 'id, name, slug, description, is_public, created_at',
  circle: 'id, title, description, category, visibility, tags, member_count, created_at',
  research:
    'id, title, description, field, methodology, expected_outcome, funding_goal_btc, funding_raised_btc, status, created_at',
  wishlist:
    'id, title, description, type, visibility, is_active, event_date, cover_image_url, created_at',
  document: 'id, title, content, document_type, visibility, tags, created_at',
};

// Entities that shouldn't appear on profile (e.g., groups have their own pages, documents are personal)
const EXCLUDED_ENTITY_TYPES: EntityType[] = ['wallet', 'group', 'document'];

interface RouteContext {
  params: Promise<{ userId: string; entityType: string }>;
}

export const GET = withOptionalAuth(async (request, context: RouteContext) => {
  try {
    const { userId, entityType } = await context.params;

    // Validate user ID
    const idValidation = getValidationError(validateUUID(userId, 'user ID'));
    if (idValidation) {
      return idValidation;
    }

    // Validate entity type
    if (!isValidEntityType(entityType)) {
      return apiBadRequest(`Invalid entity type: ${entityType}`);
    }

    // Check if entity type is allowed on profiles
    if (EXCLUDED_ENTITY_TYPES.includes(entityType as EntityType)) {
      return apiBadRequest(`Entity type ${entityType} is not displayed on profiles`);
    }

    const { supabase } = request;
    const tableName = getTableName(entityType as EntityType);
    const columns = ENTITY_COLUMNS[entityType as EntityType];
    // Ownership column comes from the entity registry (SSOT) — this route
    // previously kept its own copy of the mapping, which drifted
    const userIdField = getUserIdField(entityType as EntityType);

    // Resolve user_id to actor_id for entities that use actor-based ownership
    let filterValue = userId;
    if (userIdField === 'actor_id') {
      const actor = await getOrCreateUserActor(userId);
      filterValue = actor.id;
    }

    // Build query
    let query = supabase
      .from(tableName)
      .select(columns)
      .eq(userIdField, filterValue)
      .order('created_at', { ascending: false });

    // Exclude drafts from the public profile. Most entities use a `status` column;
    // wishlists have no status (they use is_active) — applying .neq('status',…) there
    // 500s ("column wishlists.status does not exist").
    if (entityType === 'wishlist') {
      query = query.neq('is_active', false);
    } else {
      query = query.neq('status', ENTITY_STATUS.DRAFT);
    }

    // Add show_on_profile filter (exclude false, keep true and null)
    query = query.neq('show_on_profile', false);

    // A private companion is the owner's alone; it is not a listing.
    if (entityType === 'ai_assistant') {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch profile entities', {
        userId,
        entityType,
        error: error.message,
      });
      return apiInternalError(`Failed to fetch ${entityType}s`);
    }

    // Projects: replace the dead raised_amount column with the settled-ledger
    // total so profile tabs show honest funding figures.
    const entities =
      entityType === 'project'
        ? await enrichProjectsWithSettledFunding(
            supabase,
            (data || []) as unknown as Array<{ id: string; currency?: string | null }>
          )
        : data || [];

    const metadata = getEntityMetadata(entityType as EntityType);

    return apiSuccess(
      {
        data: entities,
        entityType,
        metadata: {
          name: metadata.name,
          namePlural: metadata.namePlural,
          icon: metadata.icon.name,
          colorTheme: metadata.colorTheme,
        },
        counts: {
          total: data?.length || 0,
        },
      },
      { cache: 'SHORT' }
    );
  } catch (error) {
    logger.error('Unexpected error fetching profile entities', { error });
    return apiInternalError('Failed to fetch entities');
  }
});
