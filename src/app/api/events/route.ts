/**
 * Events API Routes
 *
 * Uses generic entity handlers for maximum modularity and DRY principles.
 * Entity metadata comes from entity-registry (Single Source of Truth)
 *
 * Created: 2025-01-28
 * Last Modified: 2026-01-05
 * Last Modified Summary: Updated to use user's preferred currency from profile (SSOT)
 */

import { eventSchema } from '@/lib/validation';
import { createEntityListHandler } from '@/lib/api/entityListHandler';
import { createEntityPostHandler } from '@/lib/api/entityPostHandler';
import { normalizeDates } from '@/lib/api/helpers';
import { CURRENCY_CODES } from '@/config/currencies';
import { getProfileCurrency } from '@/services/currency/profileCurrency';
import { withVenuePin } from '@/domain/events/venue';
import { resolveEventTimes } from '@/domain/events/time';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getOrCreateUserActor } from '@/services/actors/getOrCreateUserActor';
import { STATUS } from '@/config/database-constants';
import { EVENT_PUBLIC_STATUSES } from '@/config/events';

// Date fields that need normalization
const EVENT_DATE_FIELDS = ['start_date', 'end_date', 'rsvp_deadline'] as const;

const EVENT_DRAFT_STATUSES = Object.values(STATUS.EVENTS);

// GET /api/events - Get all published events
export const GET = createEntityListHandler({
  entityType: 'event',
  publicStatuses: [...EVENT_PUBLIC_STATUSES],
  draftStatuses: EVENT_DRAFT_STATUSES,
  orderBy: 'start_date',
  orderDirection: 'asc',
  additionalFilters: {
    event_type: 'event_type',
  },
});

// POST /api/events - Create new event
export const POST = createEntityPostHandler({
  entityType: 'event',
  schema: eventSchema,
  useActorOwnership: true,
  transformData: async (data, userId, supabase) => {
    // Get user's preferred currency from profile (SSOT)
    const userCurrency = await getProfileCurrency(supabase as AnySupabaseClient, userId);

    // Normalize dates, put the venue on the map so people nearby can find it
    // (fills latitude/longitude and the place's time zone only when missing),
    // then read the times the form sent as wall-clock times in that zone.
    const normalized = resolveEventTimes(
      await withVenuePin(normalizeDates(data, [...EVENT_DATE_FIELDS]))
    );

    // Resolve user to actor for ownership
    const actor = await getOrCreateUserActor(userId);

    // Normalize empty strings to null for optional fields
    const cleaned: Record<string, unknown> = {
      ...normalized,
      user_id: userId,
      actor_id: actor.id,
    };

    // Fields that should be null if empty string
    const optionalStringFields = [
      'description',
      'category',
      'venue_name',
      'venue_address',
      'venue_city',
      'venue_country',
      'venue_postal_code',
      'online_url',
      'bitcoin_address',
      'lightning_address',
      'thumbnail_url',
      'banner_url',
      'video_url',
      'asset_id',
      'vibe',
    ];

    for (const field of optionalStringFields) {
      if (field in cleaned && cleaned[field] === '') {
        cleaned[field] = null;
      }
    }

    // Set currency: use provided value, or user's preference, or platform default
    // Currency is ONLY for display/input - all transactions are in BTC
    if (!cleaned.currency || cleaned.currency === '') {
      cleaned.currency = userCurrency;
    }

    // Validate currency is in allowed list (should be validated by schema, but double-check)
    // This prevents database constraint violations
    if (
      cleaned.currency &&
      !CURRENCY_CODES.includes(cleaned.currency as (typeof CURRENCY_CODES)[number])
    ) {
      throw new Error(
        `Invalid currency: ${cleaned.currency}. Must be one of: ${CURRENCY_CODES.join(', ')}`
      );
    }

    // ticket_price / funding_goal are stored in the entity's chosen `currency`
    // (NOT BTC) — events are a currency-denominated priced entity, like products
    // (price) and services (fixed_price). Columns are named neutrally to match
    // (see docs/architecture/CURRENCY_AND_BITCOIN_ARCHITECTURE.md). No mapping needed:
    // the schema field name and the DB column name are identical.
    return cleaned;
  },
  defaultFields: {
    current_attendees: 0,
  },
});
