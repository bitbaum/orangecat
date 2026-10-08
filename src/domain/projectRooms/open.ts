/**
 * The investor's side of a room (ADR-0012), server-only: opening it by the
 * token their link carries, and recording what they opened.
 *
 * Recording is best-effort — a failure to write an open must never stop the
 * person the owner chose from reading the room.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ROOM_VISIT_WINDOW_MS, type RoomOpenKind } from '@/config/project-room';
import { ROUTES } from '@/config/routes';
import { getAdminClient } from '@/lib/supabase/admin';
import { looseClient } from '@/lib/supabase/untyped';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { logger } from '@/utils/logger';
import { loadProject, loadRoomContent } from './service';
import type { RoomResult, VisitorRoom } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LinkRow {
  id: string;
  project_id: string;
  label: string;
  is_shared: boolean;
  revoked_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number;
}

export interface OpenedRoom extends VisitorRoom {
  link: LinkRow;
}

const NOT_FOUND = {
  ok: false,
  code: 'not_found',
  message: 'This link doesn’t open anything.',
} as const;

export async function getRoomByToken(token: string): Promise<RoomResult<OpenedRoom>> {
  if (!UUID.test(token)) {
    return NOT_FOUND;
  }

  const { data: row, error } = await looseClient(getAdminClient())
    .from(DATABASE_TABLES.PROJECT_ROOM_LINKS)
    .select(
      'id, project_id, label, is_shared, revoked_at, first_opened_at, last_opened_at, open_count'
    )
    .eq('token', token)
    .maybeSingle();
  if (error) {
    logger.error('Failed to load room link', { error }, 'ProjectRooms');
    return { ok: false, code: 'db_error', message: 'Could not open the room' };
  }
  if (!row) {
    return NOT_FOUND;
  }
  const link = row as LinkRow;
  if (link.revoked_at) {
    return { ok: false, code: 'revoked', message: 'This link has been switched off.' };
  }

  const project = await loadProject(link.project_id);
  if (!project) {
    return NOT_FOUND;
  }
  const content = (await loadRoomContent(project.id)) ?? {
    headline: null,
    sections: [],
    metrics: [],
    metrics_as_of: null,
    deck_url: null,
    documents: [],
    contact_email: null,
  };

  return { ok: true, data: { project, content, linkLabel: link.label, link } };
}

/** True when this open of the page is a refresh of a visit already recorded. */
export function isSameVisit(lastOpenedAt: string | null, now: number = Date.now()): boolean {
  return !!lastOpenedAt && now - new Date(lastOpenedAt).getTime() < ROOM_VISIT_WINDOW_MS;
}

/**
 * Record that `link` opened `what`. The page itself counts once per visit;
 * a deck or a document counts every time, because each is a deliberate click.
 * The owner is told the first time each link is opened.
 */
export async function recordRoomOpen(
  room: OpenedRoom,
  what: RoomOpenKind,
  target: string | null = null
): Promise<void> {
  const { link, project } = room;
  if (what === 'room' && isSameVisit(link.last_opened_at)) {
    return;
  }

  const now = new Date().toISOString();
  const admin = looseClient(getAdminClient());
  try {
    const { error: insertError } = await admin.from(DATABASE_TABLES.PROJECT_ROOM_OPENS).insert({
      link_id: link.id,
      project_id: project.id,
      what,
      target,
      opened_at: now,
    });
    if (insertError) {
      throw insertError;
    }

    const { error: updateError } = await admin
      .from(DATABASE_TABLES.PROJECT_ROOM_LINKS)
      .update({
        first_opened_at: link.first_opened_at ?? now,
        last_opened_at: now,
        open_count: link.open_count + 1,
      })
      .eq('id', link.id);
    if (updateError) {
      throw updateError;
    }
  } catch (error) {
    logger.warn('Failed to record room open', { error }, 'ProjectRooms');
    return;
  }

  if (!link.first_opened_at && project.user_id) {
    const who = link.is_shared ? `Someone using “${link.label}”` : link.label;
    await NotificationDispatcher.dispatch({
      userId: project.user_id,
      type: 'room_opened',
      title: `${who} opened the ${project.title} investor room`,
      message: `${who} opened the investor room for ${project.title} for the first time. See what they looked at.`,
      actionUrl: ROUTES.PROJECTS.ROOM(project.id),
      sourceEntityType: 'project',
      sourceEntityId: project.id,
      data: { linkId: link.id },
    });
  }
}
