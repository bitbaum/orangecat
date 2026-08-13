/**
 * Group Events API
 *
 * GET  /api/groups/[slug]/events - List events
 * POST /api/groups/[slug]/events - Create event (member only)
 */

import { withAuth, withOptionalAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
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
import { DATABASE_TABLES } from '@/config/database-tables';
import { resolveGroupBySlug, checkGroupMember } from '@/domain/groups/helpers.server';
import { recordGroupActivity } from '@/services/groups/activities';
import { attachEventProfiles, fetchProfilesMap } from '@/services/groups/eventProfiles';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';
import { STATUS } from '@/config/database-constants';

type UntypedTable = any;

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  event_type: z.enum(Object.values(STATUS.GROUP_EVENTS) as [string, ...string[]]).optional(),
  location_type: z
    .enum(Object.values(STATUS.GROUP_EVENT_LOCATION_TYPES) as [string, ...string[]])
    .optional(),
  location_details: z.string().max(500).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime().optional(),
  timezone: z.string().optional(),
  max_attendees: z.number().int().positive().optional(),
  is_public: z.boolean().optional(),
  requires_rsvp: z.boolean().optional(),
});

export const GET = withOptionalAuth(
  async (req, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { supabase } = req;
      const { searchParams } = new URL(req.url);

      const group = await resolveGroupBySlug(supabase, slug);
      if (!group) {
        return apiNotFound('Group not found');
      }

      const status = searchParams.get('status') || 'upcoming';
      const event_type = searchParams.get('event_type');
      const limit = Math.min(
        parseInt(searchParams.get('limit') || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );
      const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

      // creator_id / rsvp user_id reference auth.users (not profiles), so
      // profiles cannot be embedded — attachEventProfiles splits the lookup.
      let query = (supabase.from(DATABASE_TABLES.GROUP_EVENTS) as UntypedTable)
        .select(`*, rsvps:group_event_rsvps (id, user_id, status)`, { count: 'exact' })
        .eq('group_id', group.id)
        .order('starts_at', { ascending: true })
        .range(offset, offset + limit - 1);

      // The group detail page is visitor-accessible and renders this Events
      // tab. Anonymous visitors may list only explicitly public events; signed-
      // in viewers keep the existing RLS/member view (including private events
      // where their membership permits it).
      if (!req.user) {
        if (!group.is_public) {
          return apiNotFound('Group not found');
        }
        query = query.eq('is_public', true);
      }

      if (status === 'upcoming') {
        query = query.gte('starts_at', new Date().toISOString());
      } else if (status === 'past') {
        query = query.lt('starts_at', new Date().toISOString());
      }
      if (event_type) {
        query = query.eq('event_type', event_type);
      }

      const { data: events, count, error } = await query;

      if (error) {
        logger.error('Failed to fetch events', { error, groupId: group.id }, 'Groups');
        return handleApiError(error);
      }

      return apiSuccess({
        events: await attachEventProfiles(supabase, events || []),
        total: count || 0,
        hasMore: (events?.length || 0) === limit,
      });
    } catch (error) {
      logger.error('Events GET error', { error }, 'Groups');
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

      const group = await resolveGroupBySlug(supabase, slug);
      if (!group) {
        return apiNotFound('Group not found');
      }

      const isMember = await checkGroupMember(supabase, group.id, user.id);
      if (!isMember) {
        return apiForbidden('Only group members can create events');
      }

      const body = await req.json();
      const validation = createEventSchema.safeParse(body);
      if (!validation.success) {
        return apiValidationError('Invalid request data', {
          fields: validation.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const eventData = {
        ...validation.data,
        group_id: group.id,
        creator_id: user.id,
        timezone: validation.data.timezone || 'UTC',
        event_type: validation.data.event_type || 'general',
        location_type: validation.data.location_type || 'online',
        is_public: validation.data.is_public ?? true,
        requires_rsvp: validation.data.requires_rsvp ?? false,
      };

      const { data: event, error: insertError } = await (
        supabase.from(DATABASE_TABLES.GROUP_EVENTS) as UntypedTable
      )
        .insert(eventData)
        .select()
        .single();

      if (insertError) {
        logger.error('Failed to create event', { error: insertError, groupId: group.id }, 'Groups');
        return handleApiError(insertError);
      }

      const profiles = await fetchProfilesMap(supabase, [user.id]);
      const creatorProfile = profiles.get(user.id);

      // Await so the write completes before responding — the void
      // pattern silently dropped activity rows.
      try {
        await recordGroupActivity(req.supabase, {
          group_id: group.id,
          user_id: user.id,
          activity_type: 'created_event',
          metadata: { title: eventData.title, event_id: event.id },
        });
      } catch (activityError) {
        logger.error('Failed to record event activity', activityError, 'API');
      }

      return apiCreated({
        event: {
          ...event,
          creator: creatorProfile || { id: user.id, name: null, avatar_url: null },
        },
      });
    } catch (error) {
      logger.error('Events POST error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);
