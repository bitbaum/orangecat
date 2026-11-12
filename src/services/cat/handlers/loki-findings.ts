/**
 * `file_loki_finding` and `loki_finding_status` — a bot reports what it found
 * on a live app into the project's own feedback inbox in Loki.
 *
 * Filed, never fixed. The bodies are services/loki/hands.ts, shared with a
 * bot's own work loop.
 */
import { LOKI_HANDS } from '@/services/loki/hands';
import type { ActionHandler } from './types';

export const lokiFindingHandlers: Record<string, ActionHandler> = {
  file_loki_finding: (_supabase, _userId, actorId, params) =>
    LOKI_HANDS.file_loki_finding(actorId, params),
  loki_finding_status: (_supabase, _userId, actorId, params) =>
    LOKI_HANDS.loki_finding_status(actorId, params),
};
