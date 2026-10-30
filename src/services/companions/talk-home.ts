/**
 * The talk home: everything a person can open, in one list, newest activity
 * first — the way a messaging app lays out its contacts.
 *
 * Three kinds of row, one anatomy (a face, a name with its job, the last
 * line, when): a companion the person has talked to or made, a group chat,
 * and one of the fleet's bots. The first two carry their last line from the
 * database; a fleet chat lives in the person's browser (the product on the
 * far side keeps nothing), so its last line is the browser's to add.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';
import { visibleReply } from './memory-lines';
import { fleetBots, type FleetBot } from './rooms/fleet';
import { listRooms } from './rooms/store';
import type { RoomSummary } from './rooms/types';

export interface CompanionRow {
  id: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  welcomeMessage: string | null;
  /** The person made this one. */
  mine: boolean;
  lastAt: string | null;
  preview: string | null;
}

export interface TalkHome {
  companions: CompanionRow[];
  rooms: Array<RoomSummary & { preview: string | null }>;
  fleet: { bots: FleetBot[]; mapReachable: boolean };
}

interface AssistantRow {
  id: string;
  title: string;
  description: string | null;
  avatar_url: string | null;
  welcome_message: string | null;
  user_id: string;
  updated_at: string | null;
}

interface ConversationRow {
  assistant_id: string;
  last_message_at: string | null;
  created_at: string;
  messages: Array<{ content: string; role: string; created_at: string }> | null;
}

const PREVIEW_CHARS = 140;

/** The last line, trimmed to one breath, with a companion's own bookkeeping taken out. */
export function previewOf(content: string | null | undefined, role?: string): string | null {
  if (!content) {
    return null;
  }
  const clean = (role === 'assistant' ? visibleReply(content) : content)
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) {
    return null;
  }
  return clean.length > PREVIEW_CHARS ? `${clean.slice(0, PREVIEW_CHARS - 1)}…` : clean;
}

export async function loadTalkHome(supabase: AnySupabaseClient, userId: string): Promise<TalkHome> {
  const [mine, talked, rooms, fleet] = await Promise.all([
    fromTable(supabase, DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, description, avatar_url, welcome_message, user_id, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    fromTable(supabase, DATABASE_TABLES.AI_CONVERSATIONS)
      .select(
        'assistant_id, last_message_at, created_at, messages:ai_messages(content, role, created_at)'
      )
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, referencedTable: 'ai_messages' })
      .limit(1, { referencedTable: 'ai_messages' })
      .limit(200),
    listRooms(supabase),
    fleetBots(),
  ]);
  if (mine.error) {
    logger.error('talk home: companions failed', mine.error, 'TalkHome');
  }
  if (talked.error) {
    logger.error('talk home: conversations failed', talked.error, 'TalkHome');
  }

  const byId = new Map<string, CompanionRow>();
  for (const a of (mine.data ?? []) as unknown as AssistantRow[]) {
    byId.set(a.id, {
      id: a.id,
      title: a.title,
      description: a.description,
      avatarUrl: a.avatar_url,
      welcomeMessage: a.welcome_message,
      mine: true,
      lastAt: null,
      preview: null,
    });
  }
  // The newest conversation per companion comes first, so the first hit wins.
  const seen = new Set<string>();
  const strangers: string[] = [];
  for (const c of (talked.data ?? []) as unknown as ConversationRow[]) {
    if (seen.has(c.assistant_id)) {
      continue;
    }
    seen.add(c.assistant_id);
    const last = c.messages?.[0];
    const row = byId.get(c.assistant_id);
    const lastAt = c.last_message_at ?? c.created_at;
    const preview = previewOf(last?.content, last?.role);
    if (row) {
      row.lastAt = lastAt;
      row.preview = preview;
    } else {
      strangers.push(c.assistant_id);
      byId.set(c.assistant_id, {
        id: c.assistant_id,
        title: '',
        description: null,
        avatarUrl: null,
        welcomeMessage: null,
        mine: false,
        lastAt,
        preview,
      });
    }
  }
  // Companions the person talks to but did not make: their names, under RLS
  // (a companion gone private since reads as nothing and is dropped).
  if (strangers.length > 0) {
    const { data } = await fromTable(supabase, DATABASE_TABLES.AI_ASSISTANTS)
      .select('id, title, description, avatar_url, welcome_message, user_id, updated_at')
      .in('id', strangers);
    const found = new Set<string>();
    for (const a of (data ?? []) as unknown as AssistantRow[]) {
      const row = byId.get(a.id);
      if (row) {
        row.title = a.title;
        row.description = a.description;
        row.avatarUrl = a.avatar_url;
        row.welcomeMessage = a.welcome_message;
        found.add(a.id);
      }
    }
    for (const id of strangers) {
      if (!found.has(id)) {
        byId.delete(id);
      }
    }
  }

  const roomRows = await Promise.all(
    rooms.map(async room => {
      const { data } = await fromTable(supabase, DATABASE_TABLES.COMPANION_ROOM_MESSAGES)
        .select('content, role, speaker')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = data as { content: string; role: string; speaker: string | null } | null;
      const text = previewOf(last?.content, last?.role);
      const preview =
        text && last?.role === 'assistant' && last.speaker ? `${last.speaker}: ${text}` : text;
      return { ...room, preview };
    })
  );

  return {
    companions: [...byId.values()].sort(byRecency),
    rooms: roomRows,
    fleet,
  };
}

function byRecency(a: { lastAt: string | null }, b: { lastAt: string | null }): number {
  if (a.lastAt && b.lastAt) {
    return b.lastAt.localeCompare(a.lastAt);
  }
  if (a.lastAt) {
    return -1;
  }
  if (b.lastAt) {
    return 1;
  }
  return 0;
}
