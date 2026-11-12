/**
 * `loki_sessions` and `loki_run_status` — reading the person's own Loki.
 *
 * Read-only on both sides. The bodies are services/loki/hands.ts, shared
 * with a bot's own work loop.
 */
import { LOKI_HANDS } from '@/services/loki/hands';
import type { ActionHandler } from './types';

export const lokiSessionsHandlers: Record<string, ActionHandler> = {
  loki_sessions: (_supabase, _userId, actorId, params) => LOKI_HANDS.loki_sessions(actorId, params),
  loki_run_status: (_supabase, _userId, actorId, params) =>
    LOKI_HANDS.loki_run_status(actorId, params),
};
