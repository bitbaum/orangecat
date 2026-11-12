/**
 * `ask_loki` — a question to the person's own Loki, answered as them.
 *
 * Read-only on both sides. The body is services/loki/hands.ts, shared with
 * a bot's own work loop.
 */
import { LOKI_HANDS } from '@/services/loki/hands';
import type { ActionHandler } from './types';

export const lokiAskHandlers: Record<string, ActionHandler> = {
  ask_loki: (_supabase, _userId, actorId, params) => LOKI_HANDS.ask_loki(actorId, params),
};
