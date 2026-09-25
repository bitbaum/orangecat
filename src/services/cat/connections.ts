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
  type CatConnectionLink,
} from '@/config/cat-connections';
import { API_ROUTES } from '@/config/api-routes';
import { getAdminClient } from '@/lib/supabase/admin';
import { githubConnectionConfigured, hasGitHubConnection } from '@/services/github/connection';
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
  /** Offered when set: connecting, or upgrading a partial connection. */
  offerConnect: boolean;
  /** Where DELETE disconnects it, when the user can end it from here. */
  disconnectEndpoint: string | null;
}

interface ProbeResult {
  state: CatConnectionState;
  detail?: string | null;
  /** Replaces the registry's default connect link (e.g. an OAuth start). */
  connect?: CatConnectionLink;
  /** Offer connect even while `connected` — a partial connection that can grow. */
  upgradable?: boolean;
  disconnectEndpoint?: string;
}

type Probe = (supabase: AnySupabaseClient, userId: string) => Promise<ProbeResult>;

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
    const accountReady = githubConnectionConfigured();
    const account = accountReady ? await hasGitHubConnection(getAdminClient(), userId) : null;
    if (account) {
      return {
        state: 'connected',
        detail: account.login ? `@${account.login} · private too` : 'account connected',
        disconnectEndpoint: API_ROUTES.INTEGRATIONS.GITHUB,
      };
    }
    const connect: CatConnectionLink | undefined = accountReady
      ? {
          label: 'Connect your GitHub account',
          href: API_ROUTES.INTEGRATIONS.GITHUB_CONNECT,
          kind: 'redirect',
        }
      : undefined;
    const handle = await getGitHubHandleForUser(supabase, userId);
    return handle
      ? { state: 'connected', detail: `@${handle} · public only`, connect, upgradable: !!connect }
      : { state: 'not_connected', connect };
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
        const r = await PROBES[connection.id](supabase, userId);
        return {
          ...connection,
          connect: r.connect ?? connection.connect,
          state: r.state,
          detail: r.detail ?? null,
          offerConnect: r.state === 'not_connected' || !!r.upgradable,
          disconnectEndpoint: r.disconnectEndpoint ?? null,
        };
      } catch (error) {
        logger.warn('Cat connection probe failed', { id: connection.id, error }, 'CatConnections');
        return {
          ...connection,
          state: 'unknown' as const,
          detail: null,
          offerConnect: false,
          disconnectEndpoint: null,
        };
      }
    })
  );
}
