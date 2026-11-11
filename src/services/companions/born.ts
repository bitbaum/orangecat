/**
 * A companion born with a name, a shape and a colour has no job until the
 * person answers its first question. That answer used to live only as an
 * extracted memory, which did not always exist and never reached a group
 * chat (found 2026-10-31: two companions given jobs in their own threads
 * asked "what should I help you with?" again in the room). The answer now
 * becomes the companion itself: its definition and the line under its name.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { isStarterDefinition, jobDefinition, jobLine } from '@/config/companions';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { AssistantRecord } from '@/services/ai/sendMessage-types';
import { logger } from '@/utils/logger';

/** True when this message is the owner's first word to a companion still waiting for its job. */
export function isJobAnswer(
  assistant: Pick<AssistantRecord, 'system_prompt' | 'user_id'>,
  userId: string,
  history: ReadonlyArray<{ role: string }>
): boolean {
  return (
    assistant.user_id === userId &&
    isStarterDefinition(assistant.system_prompt) &&
    !history.some(m => m.role === 'user')
  );
}

export async function adoptJob(
  supabase: AnySupabaseClient,
  assistant: Pick<AssistantRecord, 'id' | 'title'>,
  answer: string
): Promise<void> {
  const { error } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .update({ system_prompt: jobDefinition(assistant.title, answer), description: jobLine(answer) })
    .eq('id', assistant.id);
  if (error) {
    logger.warn('companion job not adopted', { error: error.message }, 'Companions');
  }
}
