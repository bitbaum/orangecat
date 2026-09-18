/**
 * Project-activity + stakeholder context for Cat.
 *
 * Lets Cat answer "what's happening with my projects?" and "who are my
 * customers?". Project activity is read from the timeline_events publish bus —
 * including build updates published by Loki (metadata.source ===
 * 'loki'), so once Loki publishes to a project's wall, Cat sees it
 * here with no further wiring. Stakeholder edges expose the typed "customer"
 * relationship (and collaborator/investor/...).
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import type { ProjectActivityEvent, StakeholderSummary } from './document-context-types';
import { getUserActorId } from '@/domain/actors';

const PROJECTS_TABLE = ENTITY_REGISTRY['project'].tableName;

/** Resolve the user's actor id (user-type actor). Returns null if none. */
async function resolveActorId(supabase: AnySupabaseClient, userId: string): Promise<string | null> {
  return getUserActorId(supabase, userId);
}

/**
 * Recent timeline events about the user's own projects (newest first).
 * Loki-published build updates surface here automatically.
 */
export async function fetchProjectActivityForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<ProjectActivityEvent[]> {
  try {
    // The user's project ids — ownership is by actor, falling back to user_id.
    const actorId = await resolveActorId(supabase, userId);
    const projectQuery = supabase.from(PROJECTS_TABLE).select('id').limit(50);
    const { data: projects } = actorId
      ? await projectQuery.eq('actor_id', actorId)
      : await projectQuery.eq('user_id', userId);

    const projectIds = (projects || []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) {
      return [];
    }

    const { data: events, error } = await supabase
      .from(DATABASE_TABLES.TIMELINE_EVENTS)
      .select('subject_id, title, description, event_type, metadata, event_timestamp')
      .eq('subject_type', 'project')
      .in('subject_id', projectIds)
      .order('event_timestamp', { ascending: false })
      .limit(15);

    if (error) {
      logger.warn(
        'Failed to fetch project activity for cat',
        { error: error.message },
        'DocumentContext'
      );
      return [];
    }

    return (
      (events as {
        subject_id: string;
        title: string;
        description: string | null;
        event_type: string;
        metadata: { source?: string } | null;
        event_timestamp: string;
      }[]) || []
    ).map(e => ({
      projectId: e.subject_id,
      title: e.title,
      description: e.description,
      eventType: e.event_type,
      source: e.metadata?.source === 'loki' ? 'loki' : 'orangecat',
      at: e.event_timestamp,
    }));
  } catch (error) {
    logger.error('Exception fetching project activity for cat', error, 'DocumentContext');
    return [];
  }
}

/**
 * Typed stakeholder edges the user owns (customer, collaborator, investor, ...).
 * The counterparty may be another OC actor/project or an external name/URL.
 */
export async function fetchStakeholdersForCat(
  supabase: AnySupabaseClient,
  userId: string
): Promise<StakeholderSummary[]> {
  try {
    const actorId = await resolveActorId(supabase, userId);
    if (!actorId) {
      return [];
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
      .select('kind, status, to_external_name, to_actor_id, to_project_id')
      .eq('owner_actor_id', actorId)
      .order('updated_at', { ascending: false })
      .limit(25);

    if (error) {
      logger.warn(
        'Failed to fetch stakeholders for cat',
        { error: error.message },
        'DocumentContext'
      );
      return [];
    }

    return (
      (data as {
        kind: string;
        status: string | null;
        to_external_name: string | null;
        to_actor_id: string | null;
        to_project_id: string | null;
      }[]) || []
    ).map(r => ({
      kind: r.kind,
      counterparty:
        r.to_external_name ||
        (r.to_actor_id
          ? 'an OrangeCat actor'
          : r.to_project_id
            ? 'an OrangeCat project'
            : 'unknown'),
      status: r.status,
    }));
  } catch (error) {
    logger.error('Exception fetching stakeholders for cat', error, 'DocumentContext');
    return [];
  }
}
