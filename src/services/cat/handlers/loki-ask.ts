/**
 * `ask_loki` — a question to the person's own Loki, answered as them.
 *
 * Read-only on both sides: the Cat relays words, Loki answers from the
 * person's projects and pages, and nothing is dispatched, approved or spent.
 * The answer is the outcome the person reads, so it is the display message.
 */
import { askLokiAsPerson } from '@/services/loki/ask';
import type { ActionHandler } from './types';

export const lokiAskHandlers: Record<string, ActionHandler> = {
  ask_loki: async (_supabase, _userId, actorId, params) => {
    const question = typeof params.question === 'string' ? params.question : '';
    const threadId = typeof params.thread_id === 'string' ? params.thread_id : undefined;

    const outcome = await askLokiAsPerson({ actorId, question, threadId });
    if (!outcome.ok) {
      return { success: false, error: outcome.reason };
    }
    return { success: true, data: { text: outcome.text, displayMessage: outcome.text } };
  },
};
