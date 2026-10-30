/**
 * Rooms in the database, through the caller's own client — RLS keeps a room
 * to its owner, so nothing here filters by user beyond what a policy already
 * enforces. Names of companion members are read with the membership (a
 * companion the viewer may no longer see reads as "Unavailable" rather than
 * leaking its title); fleet members take theirs from the fleet map.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { fleetBots, type FleetBot } from './fleet';
import { deriveRoomTitle } from './plan';
import type { NewRoomMember, RoomMember, RoomMessage, RoomSummary, RoomView } from './types';

const UNAVAILABLE = 'Unavailable';

interface RoomRow {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string | null;
}

interface MemberRow {
  id: string;
  room_id: string;
  assistant_id: string | null;
  fleet_slug: string | null;
  position: number;
  assistant: { title: string; description: string | null; avatar_url: string | null } | null;
}

interface MessageRow {
  id: string;
  role: 'user' | 'assistant';
  member_id: string | null;
  speaker: string | null;
  content: string;
  created_at: string;
}

const MEMBER_SELECT =
  'id, room_id, assistant_id, fleet_slug, position, assistant:ai_assistants(title, description, avatar_url)';

export function memberFromRow(row: MemberRow, fleet: readonly FleetBot[]): RoomMember {
  if (row.fleet_slug) {
    const bot = fleet.find(b => b.slug === row.fleet_slug);
    return {
      id: row.id,
      kind: 'fleet',
      assistantId: null,
      fleetSlug: row.fleet_slug,
      name: bot?.name ?? UNAVAILABLE,
      job: bot?.job ?? null,
      avatarUrl: bot?.mark ?? null,
      position: row.position,
    };
  }
  return {
    id: row.id,
    kind: 'companion',
    assistantId: row.assistant_id,
    fleetSlug: null,
    name: row.assistant?.title ?? UNAVAILABLE,
    job: row.assistant?.description ?? null,
    avatarUrl: row.assistant?.avatar_url ?? null,
    position: row.position,
  };
}

function messageFromRow(row: MessageRow): RoomMessage {
  return {
    id: row.id,
    role: row.role,
    memberId: row.member_id,
    speaker: row.speaker,
    content: row.content,
    createdAt: row.created_at,
  };
}

async function membersOf(
  supabase: AnySupabaseClient,
  roomIds: readonly string[]
): Promise<Map<string, RoomMember[]>> {
  const out = new Map<string, RoomMember[]>();
  if (roomIds.length === 0) {
    return out;
  }
  const [{ data, error }, { bots }] = await Promise.all([
    fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MEMBERS)
      .select(MEMBER_SELECT)
      .in('room_id', roomIds)
      .order('position', { ascending: true }),
    fleetBots(),
  ]);
  if (error) {
    logger.error('room members failed to load', error, 'CompanionRooms');
    return out;
  }
  for (const raw of (data ?? []) as unknown as MemberRow[]) {
    const list = out.get(raw.room_id) ?? [];
    list.push(memberFromRow(raw, bots));
    out.set(raw.room_id, list);
  }
  return out;
}

export async function listRooms(supabase: AnySupabaseClient): Promise<RoomSummary[]> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .select('id, title, created_at, last_message_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('rooms failed to load', error, 'CompanionRooms');
    throw error;
  }
  const rows = (data ?? []) as unknown as RoomRow[];
  const members = await membersOf(
    supabase,
    rows.map(r => r.id)
  );
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    createdAt: r.created_at,
    lastMessageAt: r.last_message_at,
    members: members.get(r.id) ?? [],
  }));
}

export async function getRoom(
  supabase: AnySupabaseClient,
  roomId: string
): Promise<RoomView | null> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .select('id, title, created_at, last_message_at')
    .eq('id', roomId)
    .maybeSingle();
  if (error || !data) {
    return null;
  }
  const row = data as unknown as RoomRow;
  const [members, { data: msgs, error: msgError }] = await Promise.all([
    membersOf(supabase, [row.id]),
    fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MESSAGES)
      .select('id, role, member_id, speaker, content, created_at')
      .eq('room_id', row.id)
      .order('created_at', { ascending: true }),
  ]);
  if (msgError) {
    logger.error('room messages failed to load', msgError, 'CompanionRooms');
    throw msgError;
  }
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at,
    members: members.get(row.id) ?? [],
    messages: ((msgs ?? []) as unknown as MessageRow[]).map(messageFromRow),
  };
}

/**
 * Open a room. The members are inserted after the row; the title, when none
 * was given, is the members' names once they are known.
 */
export async function createRoom(
  supabase: AnySupabaseClient,
  userId: string,
  input: { title?: string | null; members: readonly NewRoomMember[] }
): Promise<RoomSummary> {
  const { data: created, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .insert({ user_id: userId, title: input.title?.trim() || 'Group chat' })
    .select('id, title, created_at, last_message_at')
    .single();
  if (error || !created) {
    logger.error('room could not be created', error, 'CompanionRooms');
    throw error ?? new Error('Room could not be created');
  }
  const room = created as unknown as RoomRow;
  const rows = input.members.map((m, position) => ({
    room_id: room.id,
    assistant_id: 'assistantId' in m ? m.assistantId : null,
    fleet_slug: 'fleetSlug' in m ? m.fleetSlug : null,
    position,
  }));
  const { error: memberError } = await fromTable(
    supabase,
    DATABASE_TABLES.COMPANION_ROOM_MEMBERS
  ).insert(rows);
  if (memberError) {
    // A room with nobody in it is noise; take it back.
    await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS).delete().eq('id', room.id);
    logger.error('room members could not be added', memberError, 'CompanionRooms');
    throw memberError;
  }
  const members = (await membersOf(supabase, [room.id])).get(room.id) ?? [];
  let title = room.title;
  if (!input.title?.trim()) {
    title = deriveRoomTitle(members.map(m => m.name));
    await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS).update({ title }).eq('id', room.id);
  }
  return {
    id: room.id,
    title,
    createdAt: room.created_at,
    lastMessageAt: room.last_message_at,
    members,
  };
}

export async function renameRoom(
  supabase: AnySupabaseClient,
  roomId: string,
  title: string
): Promise<boolean> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

export async function deleteRoom(supabase: AnySupabaseClient, roomId: string): Promise<boolean> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .delete()
    .eq('id', roomId)
    .select('id');
  return !error && Array.isArray(data) && data.length > 0;
}

export async function appendRoomMessage(
  supabase: AnySupabaseClient,
  roomId: string,
  message: {
    role: 'user' | 'assistant';
    memberId?: string | null;
    speaker?: string | null;
    content: string;
  }
): Promise<RoomMessage> {
  const { data, error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MESSAGES)
    .insert({
      room_id: roomId,
      role: message.role,
      member_id: message.memberId ?? null,
      speaker: message.speaker ?? null,
      content: message.content,
    })
    .select('id, role, member_id, speaker, content, created_at')
    .single();
  if (error || !data) {
    logger.error('room message could not be stored', error, 'CompanionRooms');
    throw error ?? new Error('Message could not be stored');
  }
  const now = new Date().toISOString();
  await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOMS)
    .update({ last_message_at: now, updated_at: now })
    .eq('id', roomId);
  return messageFromRow(data as unknown as MessageRow);
}

/** Seat one more member; the caller has checked the count and the companion's visibility. */
export async function addRoomMember(
  supabase: AnySupabaseClient,
  roomId: string,
  member: NewRoomMember
): Promise<RoomMember[]> {
  const { data: last } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MEMBERS)
    .select('position')
    .eq('room_id', roomId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = ((last as { position?: number } | null)?.position ?? -1) + 1;
  const { error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MEMBERS).insert({
    room_id: roomId,
    assistant_id: 'assistantId' in member ? member.assistantId : null,
    fleet_slug: 'fleetSlug' in member ? member.fleetSlug : null,
    position,
  });
  if (error) {
    logger.error('room member could not be added', error, 'CompanionRooms');
    throw error;
  }
  return (await membersOf(supabase, [roomId])).get(roomId) ?? [];
}

/** A member leaves; its lines stay, in its name (member_id becomes null, speaker does not). */
export async function removeRoomMember(
  supabase: AnySupabaseClient,
  roomId: string,
  memberId: string
): Promise<RoomMember[]> {
  const { error } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MEMBERS)
    .delete()
    .eq('room_id', roomId)
    .eq('id', memberId);
  if (error) {
    logger.error('room member could not be removed', error, 'CompanionRooms');
    throw error;
  }
  return (await membersOf(supabase, [roomId])).get(roomId) ?? [];
}
