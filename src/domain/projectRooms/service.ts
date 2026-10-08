/**
 * The owner's side of a project's investor room (ADR-0012), server-only.
 *
 * The three room tables have no anon/authenticated policies (see the
 * migration), so everything here goes through the service-role client — and
 * every export that takes a projectId first proves, with the CALLER's client,
 * that the caller owns the project. `checkOwnership` is actor-based, so a room
 * on a group's project is managed by its members, like the project itself.
 *
 * `.from(DATABASE_TABLES.X)` is written inline at every call on purpose:
 * scripts/db/audit-schema-drift.mjs resolves columns by the nearest preceding
 * literal `.from(...)`, and a helper hiding it misattributes every column after
 * it (see profileClaims/service.ts).
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import { ROOM_OUTLINE, type NewRoomLink, type RoomContent } from '@/config/project-room';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { checkOwnership } from '@/services/actors';
import { logger } from '@/utils/logger';
import { normalizeRoomContent } from './content';
import type { OwnerRoom, RoomLink, RoomOpen, RoomProject, RoomResult } from './types';

const PROJECT_COLUMNS = 'id, title, description, website_url, cover_image_url, actor_id, user_id';
const LINK_COLUMNS =
  'id, token, label, email, is_shared, created_at, revoked_at, first_opened_at, last_opened_at, open_count';
/** The owner's view lists recent activity, not the whole history. */
const RECENT_OPENS = 200;

const NOT_FOUND = { ok: false, code: 'not_found', message: 'Project not found' } as const;
const FORBIDDEN = {
  ok: false,
  code: 'forbidden',
  message: 'Only the project’s owner can manage its investor room',
} as const;

function dbError(message: string, error: unknown): RoomResult<never> {
  logger.error(message, { error }, 'ProjectRooms');
  return { ok: false, code: 'db_error', message };
}

export async function loadProject(projectId: string): Promise<RoomProject | null> {
  const { data } = await looseClient(getAdminClient())
    .from(getTableName('project'))
    .select(PROJECT_COLUMNS)
    .eq('id', projectId)
    .maybeSingle();
  return (data as RoomProject | null) ?? null;
}

/** The project, if `userId` may manage it. Uses the caller's client for the membership read. */
export async function loadOwnedProject(
  projectId: string,
  userId: string,
  supabase: AnySupabaseClient
): Promise<RoomResult<RoomProject>> {
  const project = await loadProject(projectId);
  if (!project) {
    return NOT_FOUND;
  }
  const owns = await checkOwnership({ actor_id: project.actor_id }, userId, supabase);
  return owns ? { ok: true, data: project } : FORBIDDEN;
}

/** The room content of a project, or null when none has been saved. */
export async function loadRoomContent(projectId: string): Promise<RoomContent | null> {
  const { data } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOMS)
    .select('headline, sections, metrics, metrics_as_of, deck_url, documents, contact_email')
    .eq('project_id', projectId)
    .maybeSingle();
  return data ? normalizeRoomContent(data) : null;
}

export async function getOwnerRoom(
  projectId: string,
  userId: string,
  supabase: AnySupabaseClient
): Promise<RoomResult<OwnerRoom>> {
  const owned = await loadOwnedProject(projectId, userId, supabase);
  if (!owned.ok) {
    return owned;
  }
  const admin = looseClient(getAdminClient());

  const content = await loadRoomContent(projectId);

  const { data: links, error: linksError } = await admin
    .from(DATABASE_TABLES.PROJECT_ROOM_LINKS)
    .select(LINK_COLUMNS)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (linksError) {
    return dbError('Failed to load room links', linksError);
  }

  const { data: opens, error: opensError } = await admin
    .from(DATABASE_TABLES.PROJECT_ROOM_OPENS)
    .select('link_id, what, target, opened_at')
    .eq('project_id', projectId)
    .order('opened_at', { ascending: false })
    .limit(RECENT_OPENS);
  if (opensError) {
    return dbError('Failed to load room opens', opensError);
  }

  return {
    ok: true,
    data: {
      project: owned.data,
      exists: content !== null,
      content: content ?? {
        headline: null,
        sections: [...ROOM_OUTLINE],
        metrics: [],
        metrics_as_of: null,
        deck_url: null,
        documents: [],
        contact_email: null,
      },
      links: (links ?? []) as RoomLink[],
      opens: (opens ?? []) as RoomOpen[],
    },
  };
}

export async function saveRoomContent(
  projectId: string,
  userId: string,
  supabase: AnySupabaseClient,
  content: RoomContent
): Promise<RoomResult<RoomContent>> {
  const owned = await loadOwnedProject(projectId, userId, supabase);
  if (!owned.ok) {
    return owned;
  }

  const { error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOMS)
    .upsert(
      {
        project_id: projectId,
        headline: content.headline || null,
        sections: content.sections,
        metrics: content.metrics,
        metrics_as_of: content.metrics_as_of || null,
        deck_url: content.deck_url || null,
        documents: content.documents,
        contact_email: content.contact_email || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'project_id' }
    );
  if (error) {
    return dbError('Failed to save room', error);
  }
  return { ok: true, data: content };
}

export async function createRoomLink(
  projectId: string,
  userId: string,
  supabase: AnySupabaseClient,
  input: NewRoomLink
): Promise<RoomResult<RoomLink>> {
  const owned = await loadOwnedProject(projectId, userId, supabase);
  if (!owned.ok) {
    return owned;
  }

  const { data, error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOM_LINKS)
    .insert({
      project_id: projectId,
      label: input.label,
      email: input.email || null,
      is_shared: input.is_shared ?? false,
      created_by: userId,
    })
    .select(LINK_COLUMNS)
    .single();
  if (error || !data) {
    return dbError('Failed to create room link', error);
  }
  return { ok: true, data: data as RoomLink };
}

/** Switch a link off. Its history stays: who opened what is still true. */
export async function revokeRoomLink(
  projectId: string,
  linkId: string,
  userId: string,
  supabase: AnySupabaseClient
): Promise<RoomResult<{ id: string }>> {
  const owned = await loadOwnedProject(projectId, userId, supabase);
  if (!owned.ok) {
    return owned;
  }

  const { data, error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOM_LINKS)
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();
  if (error) {
    return dbError('Failed to revoke room link', error);
  }
  if (!data) {
    return { ok: false, code: 'not_found', message: 'Link not found' };
  }
  return { ok: true, data: { id: linkId } };
}
