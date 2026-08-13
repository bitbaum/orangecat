/**
 * Timeline Event Enrichment
 *
 * Enriches timeline events with actor, subject, and target information.
 *
 * Previously a classic N+1: each event triggered up to three sequential
 * `.single()` lookups (actor + subject + target). For a 20-event timeline
 * that meant up to 60 serial round-trips. Now we collect every distinct
 * id up front, batch them by table, then build O(1) lookup maps used by
 * the synchronous mapping step. Worst case is 3 batched queries total.
 */

import { fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName, ENTITY_REGISTRY } from '@/config/entity-registry';
import { optionalPublicProfilePath } from '@/config/public-profile-path';
import type {
  TimelineDisplayEvent,
  TimelineActorType,
  TimelineSubjectType,
  TimelineEventDb,
} from '@/types/timeline';
import {
  mapDbEventToTimelineEvent,
  getEventIcon,
  getEventDisplayType,
  formatAmount,
  getTimeAgo,
  isEventRecent,
} from '../formatters';

interface ProfileRow {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ProjectRow {
  id: string;
  title: string | null;
}

type ActorInfo = {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  type: TimelineActorType;
};

type SubjectInfo = {
  id: string;
  name: string;
  type: TimelineSubjectType;
  url?: string;
};

/**
 * Get actor information for a single id. Retained for callers that
 * resolve one actor at a time (e.g., notification copy). Hot paths
 * (timeline enrichment) should use the batched version below.
 */
export async function getActorInfo(actorId: string): Promise<ActorInfo> {
  const { data: profile } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
    .select('id, name, username, avatar_url')
    .eq('id', actorId)
    .maybeSingle();
  return profileRowToActor(actorId, profile as ProfileRow | null);
}

/**
 * Get subject information for a single (type, id). Same one-off shape as
 * getActorInfo; prefer the batch helpers in hot paths.
 */
export async function getSubjectInfo(type: TimelineSubjectType, id: string): Promise<SubjectInfo> {
  switch (type) {
    case 'project': {
      const { data: project } = await fromTable(supabase, getTableName('project'))
        .select('id, title')
        .eq('id', id)
        .maybeSingle();
      return projectRowToSubject(id, project as ProjectRow | null);
    }
    case 'profile': {
      const { data: profile } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
        .select('id, name, username')
        .eq('id', id)
        .maybeSingle();
      return profileRowToSubject(id, profile as ProfileRow | null);
    }
    default:
      return { id, name: `Unknown ${type}`, type };
  }
}

function profileRowToActor(id: string, profile: ProfileRow | null): ActorInfo {
  return {
    id,
    name: profile?.name || profile?.username || 'Unknown User',
    username: profile?.username ?? undefined,
    avatar: profile?.avatar_url ?? undefined,
    type: 'user',
  };
}

function projectRowToSubject(id: string, project: ProjectRow | null): SubjectInfo {
  return {
    id,
    name: project?.title || 'Unknown Project',
    type: 'project',
    url: `${ENTITY_REGISTRY['project'].publicBasePath}/${id}`,
  };
}

function profileRowToSubject(id: string, profile: ProfileRow | null): SubjectInfo {
  return {
    id,
    name: profile?.name || profile?.username || 'Unknown User',
    type: 'profile',
    url: optionalPublicProfilePath(profile?.username) ?? undefined,
  };
}

/**
 * Enrich events for display — batch version. Collects every distinct
 * profileId + projectId across the batch, fetches each set in a single
 * `.in('id', ids)` query, then resolves actor/subject/target via map
 * lookups. Three queries total regardless of batch size.
 */
export async function enrichEventsForDisplay(events: unknown[]): Promise<TimelineDisplayEvent[]> {
  const timelineEvents = events.map(e => mapDbEventToTimelineEvent(e as TimelineEventDb));

  // Collect distinct ids per kind. `subject`/`target` can be either a
  // project or a profile depending on its type field.
  const profileIds = new Set<string>();
  const projectIds = new Set<string>();
  for (const ev of timelineEvents) {
    profileIds.add(ev.actorId);
    if (ev.subjectId) {
      if (ev.subjectType === 'project') {
        projectIds.add(ev.subjectId);
      } else if (ev.subjectType === 'profile') {
        profileIds.add(ev.subjectId);
      }
    }
    if (ev.targetId && ev.targetType) {
      if (ev.targetType === 'project') {
        projectIds.add(ev.targetId);
      } else if (ev.targetType === 'profile') {
        profileIds.add(ev.targetId);
      }
    }
  }

  // One round-trip per kind, in parallel.
  const [profilesById, projectsById] = await Promise.all([
    fetchProfilesById(Array.from(profileIds)),
    fetchProjectsById(Array.from(projectIds)),
  ]);

  const resolveSubject = (type: TimelineSubjectType, id: string): SubjectInfo => {
    if (type === 'project') {
      return projectRowToSubject(id, projectsById.get(id) ?? null);
    }
    if (type === 'profile') {
      return profileRowToSubject(id, profilesById.get(id) ?? null);
    }
    return { id, name: `Unknown ${type}`, type };
  };

  return timelineEvents.map(timelineEvent => {
    const actor = profileRowToActor(
      timelineEvent.actorId,
      profilesById.get(timelineEvent.actorId) ?? null
    );
    const subject = timelineEvent.subjectId
      ? resolveSubject(timelineEvent.subjectType, timelineEvent.subjectId)
      : undefined;
    const target =
      timelineEvent.targetId && timelineEvent.targetType
        ? resolveSubject(timelineEvent.targetType, timelineEvent.targetId)
        : undefined;

    return {
      ...timelineEvent,
      icon: getEventIcon(timelineEvent.eventType),
      displayType: getEventDisplayType(timelineEvent.eventType),
      displaySubtype: timelineEvent.eventSubtype,
      actor,
      subject,
      target,
      formattedAmount: formatAmount(timelineEvent),
      timeAgo: getTimeAgo(timelineEvent.eventTimestamp),
      isRecent: isEventRecent(timelineEvent.eventTimestamp),
    } as TimelineDisplayEvent;
  });
}

async function fetchProfilesById(ids: string[]): Promise<Map<string, ProfileRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data } = await fromTable(supabase, DATABASE_TABLES.PROFILES)
    .select('id, name, username, avatar_url')
    .in('id', ids);
  const map = new Map<string, ProfileRow>();
  for (const row of (data || []) as ProfileRow[]) {
    if (row?.id) {
      map.set(row.id, row);
    }
  }
  return map;
}

async function fetchProjectsById(ids: string[]): Promise<Map<string, ProjectRow>> {
  if (ids.length === 0) {
    return new Map();
  }

  const { data } = await fromTable(supabase, getTableName('project'))
    .select('id, title')
    .in('id', ids);
  const map = new Map<string, ProjectRow>();
  for (const row of (data || []) as ProjectRow[]) {
    if (row?.id) {
      map.set(row.id, row);
    }
  }
  return map;
}
