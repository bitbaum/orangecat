/**
 * Per-user status of every Cat connection (the list is config/cat-connections).
 *
 * Four states, because "not connected" and "could not tell" must never look
 * the same — telling someone their Loki is disconnected while Loki is merely
 * slow would send them to fix something that is not broken:
 *
 *   connected      — this person is linked, with a short detail when useful
 *   not_connected  — the connection is available and they have not set it up
 *   everyone       — nothing to connect; it works for every account
 *   unknown        — the check itself failed or the rail is not armed here
 *
 * Probes run in parallel and none can fail another.
 */

import {
  CAT_CONNECTIONS,
  type CatConnection,
  type CatConnectionId,
} from '@/config/cat-connections';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getUserActorId } from '@/domain/actors';
import { getGitHubHandleForUser } from '@/services/ai/github-repos-fetcher';
import { fetchLokiActorStatus } from '@/services/loki/actor-status';
import { logger } from '@/utils/logger';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export type CatConnectionState = 'connected' | 'not_connected' | 'everyone' | 'unknown';

export interface CatConnectionStatus extends CatConnection {
  state: CatConnectionState;
  /** e.g. "3 projects", "@octocat" — shown beside the state. */
  detail: string | null;
}

type Probe = (
  supabase: AnySupabaseClient,
  userId: string
) => Promise<{ state: CatConnectionState; detail?: string | null }>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const PROBES: Record<CatConnectionId, Probe> = {
  loki: async (supabase, userId) => {
    const actorId = await getUserActorId(supabase, userId);
    if (!actorId) {
      return { state: 'unknown' };
    }
    const status = await fetchLokiActorStatus(actorId);
    if (!status) {
      return { state: 'unknown' };
    }
    return status.linked
      ? { state: 'connected', detail: plural(status.projects.length, 'project') }
      : { state: 'not_connected' };
  },

  // Solon governs the platform itself today, so there is no per-user link.
  solon: async () => ({ state: 'everyone' }),

  github: async (supabase, userId) => {
    const handle = await getGitHubHandleForUser(supabase, userId);
    return handle ? { state: 'connected', detail: `@${handle}` } : { state: 'not_connected' };
  },

  lightning: async (supabase, userId) => {
    const { data, error } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .select('lightning_address')
      .eq('profile_id', userId)
      .eq('is_active', true)
      .limit(20);
    if (error) {
      return { state: 'unknown' };
    }
    const wallets = (data ?? []) as Array<{ lightning_address: string | null }>;
    if (wallets.length === 0) {
      return { state: 'not_connected' };
    }
    const address = wallets.find(w => w.lightning_address)?.lightning_address;
    return { state: 'connected', detail: address ?? plural(wallets.length, 'wallet') };
  },
};

export async function getCatConnectionStatuses(
  supabase: AnySupabaseClient,
  userId: string
): Promise<CatConnectionStatus[]> {
  return Promise.all(
    CAT_CONNECTIONS.map(async connection => {
      try {
        const { state, detail = null } = await PROBES[connection.id](supabase, userId);
        return { ...connection, state, detail };
      } catch (error) {
        logger.warn('Cat connection probe failed', { id: connection.id, error }, 'CatConnections');
        return { ...connection, state: 'unknown' as const, detail: null };
      }
    })
  );
}
