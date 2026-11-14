/**
 * The Cat writes an entry the person plainly asked for, in code, before the
 * model answers (calendar-intent.ts says when a message is such an ask).
 * The model is then told what was added, so all it has to do is confirm it;
 * it is also told not to add it again, since it holds calendar_add too.
 *
 * Only where the person's own Cat permission allows calendar_add (on by
 * default, like every action on their own things). Never throws: a write
 * that cannot happen leaves the turn to the model.
 */

import { todayIn } from '@bitbaum/whenkit';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CatPermissionService } from '@/services/cat/permission-service';
import { logger } from '@/utils/logger';
import { addCalendarEntry, whenText } from './calendar';
import { calendarWriteIntent, entryParams } from './calendar-intent';
import { plannerZone } from './zone';

export interface ChatWrite {
  /** What goes in front of the model. */
  block: string;
  /** What was written, for the check that the answer says only what happened. */
  evidence: string[];
}

export async function writeCalendarFromChat(
  supabase: AnySupabaseClient,
  userId: string,
  message: string,
  offeredZone: string | null | undefined,
  now: Date = new Date()
): Promise<ChatWrite | null> {
  try {
    const zone = await plannerZone(supabase, userId, offeredZone);
    const entry = calendarWriteIntent(message, todayIn(zone ?? 'UTC', now));
    if (!entry) {
      return null;
    }
    const check = await new CatPermissionService(supabase).checkPermission(userId, 'calendar_add');
    if (!check.allowed) {
      return null;
    }
    const added = await addCalendarEntry(supabase, userId, entryParams(entry), {
      madeBy: 'cat',
      zone,
    });
    const row = added.data as { starts_at?: string; id?: string } | undefined;
    const said = added.success
      ? `Added to their calendar just now: "${entry.title}" on ${whenText(
          row?.starts_at ?? '',
          !entry.time,
          zone
        )}${entry.time ? ` for ${entry.minutes ?? 60} minutes` : ''}${
          entry.place ? ` at ${entry.place}` : ''
        } [entry_id: ${row?.id ?? ''}].`
      : `Their calendar could not be written just now: ${added.error ?? 'no reason given'}.`;
    return {
      block: [
        '## Done just now, for this message',
        said,
        added.success
          ? 'Confirm it in one short sentence with the day and time as written above. Do not call calendar_add for it again. If the day or time looks wrong to you, say so and offer to change it.'
          : 'Say so in one plain sentence; nothing was added.',
      ].join('\n\n'),
      evidence: [said],
    };
  } catch (error) {
    logger.warn('calendar write from chat failed', { error }, 'PlannerChatWrite');
    return null;
  }
}
