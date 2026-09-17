/**
 * Timeline Query Helpers
 *
 * Helper functions for timeline feed queries.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Extracted from feeds.ts
 */

import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { TimelineDisplayEvent, TimelineEventDb, TimelineActorType } from '@/types/timeline';
import type { Database } from '@/types/database';
import {
  mapDbEventToTimelineEvent,
  getEventIcon,
  getEventDisplayType,
  formatAmount,
  getTimeAgo,
  isEventRecent,
} from '@/services/timeline/formatters';

// Defined once, in the auth layer, where it is cached. See session.ts.
export { getCurrentUserId } from '@/services/supabase/auth/session';

/**
 * Helper to transform enriched view events to display events
 */
type ActorData = { id: string; username?: string; display_name?: string; avatar_url?: string };
type SubjectData = {
  id: string;
  type: string;
  username?: string;
  display_name?: string;
  title?: string;
};
type EnrichedEventRow = TimelineEventDb & {
  actor_data?: ActorData | null;
  subject_data?: SubjectData | null;
  target_data?: SubjectData | null;
};

/**
 * The two enriched timeline views feeds read from. Their `*_data` columns are
 * `jsonb`, so the schema types them as `Json`.
 */
type EnrichedTimelineViewRow =
  | Database['public']['Views']['enriched_timeline_events']['Row']
  | Database['public']['Views']['community_timeline_no_duplicates']['Row'];

export function transformEnrichedEventToDisplay(
  row: EnrichedTimelineViewRow
): TimelineDisplayEvent {
  // The view returns the event's own snake_case columns plus the joined actor /
  // subject / target JSON blobs. `EnrichedEventRow` is that same row with those
  // blobs given their real shape — the one narrowing point for these feeds.
  const event = row as unknown as EnrichedEventRow;
  const timelineEvent = mapDbEventToTimelineEvent(event);

  // Omit eventType and eventSubtype as TimelineDisplayEvent extends Omit<TimelineEvent, 'eventType' | 'eventSubtype'>
  const {
    eventType: _eventType,
    eventSubtype: _eventSubtype,
    ...eventWithoutTypes
  } = timelineEvent;

  return {
    ...eventWithoutTypes,
    icon: getEventIcon(timelineEvent.eventType),
    displayType: getEventDisplayType(timelineEvent.eventType),
    displaySubtype: timelineEvent.eventSubtype,
    // Actor, subject, target data already pre-joined in VIEW
    actor: event.actor_data
      ? {
          id: event.actor_data.id,
          name: event.actor_data.display_name || event.actor_data.username || 'Unknown',
          username: event.actor_data.username,
          avatar: event.actor_data.avatar_url,
          type: 'user' as TimelineActorType,
        }
      : {
          id: event.actorId || 'unknown',
          name: 'Unknown',
          type: 'user' as TimelineActorType,
        },
    subject: event.subject_data
      ? {
          id: event.subject_data.id,
          name:
            event.subject_data.type === 'profile'
              ? event.subject_data.display_name || event.subject_data.username || ''
              : event.subject_data.title || '',
          type: event.subject_data.type as import('@/types/timeline').TimelineSubjectType,
          url:
            event.subject_data.type === 'profile'
              ? `/profiles/${event.subject_data.username || event.subject_data.id}`
              : `${ENTITY_REGISTRY['project'].publicBasePath}/${event.subject_data.id}`,
        }
      : undefined,
    target: event.target_data
      ? {
          id: event.target_data.id,
          name:
            event.target_data.type === 'profile'
              ? event.target_data.display_name || event.target_data.username || ''
              : event.target_data.title || '',
          type: event.target_data.type as import('@/types/timeline').TimelineSubjectType,
          url:
            event.target_data.type === 'profile'
              ? `/profiles/${event.target_data.username || event.target_data.id}`
              : `${ENTITY_REGISTRY['project'].publicBasePath}/${event.target_data.id}`,
        }
      : undefined,
    formattedAmount: formatAmount(timelineEvent),
    timeAgo: getTimeAgo(timelineEvent.eventTimestamp),
    isRecent: isEventRecent(timelineEvent.eventTimestamp),
  };
}
