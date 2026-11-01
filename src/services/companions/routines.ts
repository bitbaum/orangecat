/**
 * A bot that writes first: the runner.
 *
 * Runs every routine whose time has come, as its owner, on the owner's own
 * key (routines-store.ts holds the row and the rules). The one cron route
 * that reaches a model besides the @cat mention worker, and for the same
 * reason: a person asked, by setting the routine, and it is their key, never
 * the platform's; `skipReason` keeps it that way whether or not anyone
 * remembers the rule.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { ROUTES } from '@/config/routes';
import { NotificationService } from '@/lib/services/notifications';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { fromTable } from '@/lib/supabase/untyped';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { sendAiMessage } from '@/services/ai/sendMessage';
import { logger } from '@/utils/logger';
import { nextRunAt, skipReason, type RoutineRow } from './routines-store';

const LOG = 'CompanionRoutines';
/** Shown in the list and the notification: the first breath of the reply. */
const NOTIFY_CHARS = 160;

export interface RoutineRunResult {
  due: number;
  ran: number;
  skipped: number;
  errors: number;
}

/**
 * Run every routine whose time has come, as its owner, on the owner's own
 * key. Each one is moved to its next run first, so a crash cannot make a
 * bot write twice; a skipped run keeps its reason on the row.
 */
export async function runDueRoutines(
  admin: AnySupabaseClient,
  limit: number,
  now = new Date()
): Promise<RoutineRunResult> {
  const result: RoutineRunResult = { due: 0, ran: 0, skipped: 0, errors: 0 };
  const { data } = await fromTable(admin, DATABASE_TABLES.COMPANION_ROUTINES)
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', now.toISOString())
    .order('next_run_at', { ascending: true })
    .limit(limit);
  const rows = (data ?? []) as RoutineRow[];
  result.due = rows.length;
  const keys = createApiKeyService(admin);
  const notifications = new NotificationService(admin);
  for (const row of rows) {
    try {
      const next = nextRunAt(now, row.time_local, row.zone);
      const hasOwnKey = Boolean(await keys.getDecryptedKey(row.user_id, 'openrouter'));
      const reason = skipReason(hasOwnKey);
      if (reason) {
        await fromTable(admin, DATABASE_TABLES.COMPANION_ROUTINES)
          .update({ next_run_at: next, skipped_reason: reason, updated_at: now.toISOString() })
          .eq('id', row.id);
        result.skipped += 1;
        continue;
      }
      const conversationId = await ensureThread(admin, row);
      await fromTable(admin, DATABASE_TABLES.COMPANION_ROUTINES)
        .update({
          next_run_at: next,
          last_run_at: now.toISOString(),
          skipped_reason: null,
          conversation_id: conversationId,
          updated_at: now.toISOString(),
        })
        .eq('id', row.id);
      const sent = await sendAiMessage(
        admin as SupabaseClient,
        row.user_id,
        row.assistant_id,
        conversationId,
        row.prompt
      );
      if ('code' in sent) {
        result.errors += 1;
        logger.warn('routine turn failed', { id: row.id, code: sent.code }, LOG);
        continue;
      }
      const reply = String(sent.assistantMessage.content ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      const { data: bot } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
        .select('title')
        .eq('id', row.assistant_id)
        .maybeSingle();
      await notifications.createNotification({
        recipientUserId: row.user_id,
        type: 'system',
        title: String((bot as { title?: string } | null)?.title ?? 'Your bot'),
        message: reply.length > NOTIFY_CHARS ? `${reply.slice(0, NOTIFY_CHARS - 1)}…` : reply,
        actionUrl: ROUTES.AI_ASSISTANTS.TALK_WITH(row.assistant_id),
        metadata: { kind: 'companion_routine', assistantId: row.assistant_id },
      });
      result.ran += 1;
    } catch (error) {
      result.errors += 1;
      logger.error('routine run failed', { id: row.id, error }, LOG);
    }
  }
  return result;
}

/** The routine's thread: the one it used before, else the bot's newest active one, else a new one. */
async function ensureThread(admin: AnySupabaseClient, row: RoutineRow): Promise<string> {
  if (row.conversation_id) {
    return row.conversation_id;
  }
  const { data: existing } = await fromTable(admin, DATABASE_TABLES.AI_CONVERSATIONS)
    .select('id')
    .eq('assistant_id', row.assistant_id)
    .eq('user_id', row.user_id)
    .eq('status', STATUS.AI_CONVERSATIONS.ACTIVE)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return (existing as { id: string }).id;
  }
  const { data, error } = await fromTable(admin, DATABASE_TABLES.AI_CONVERSATIONS)
    .insert({
      assistant_id: row.assistant_id,
      user_id: row.user_id,
      status: STATUS.AI_CONVERSATIONS.ACTIVE,
    })
    .select('id')
    .single();
  if (error) {
    throw error;
  }
  return (data as { id: string }).id;
}
