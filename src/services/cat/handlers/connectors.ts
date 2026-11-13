/**
 * `github_read`, `gmail_read` and `calendar_read`: reading the accounts the
 * person connected.
 *
 * Read-only. The bodies are services/connectors/hands.ts, shared with a
 * bot's own work loop.
 */
import { CONNECTOR_HANDS } from '@/services/connectors/hands';
import type { ActionHandler } from './types';

export const connectorHandlers: Record<string, ActionHandler> = Object.fromEntries(
  Object.entries(CONNECTOR_HANDS).map(([id, hand]): [string, ActionHandler] => [
    id,
    (_supabase, userId, _actorId, params) => hand(userId, params),
  ])
);
