/**
 * Loki → Cat: what is happening to this person's projects in Loki.
 *
 * Until this existed the rail ran one way. Cat could hand work over
 * (send_to_loki mints a link, build_site commissions a site) and then never
 * learn what happened to it — whether the site went live, whether the build
 * is blocked waiting on its owner, whether visitors left feedback. A person
 * asking "how is my site doing?" got a guess.
 *
 * Contract (Loki: src/app/api/orangecat/actor-status/route.ts):
 *   POST, signed with ORANGECAT_WEBHOOK_SECRET under x-orangecat-signature
 *   (the same rail as entitlement/events/site — see ./signed-post), body
 *   { actorId, issuedAt }. Loki rejects a request older than five minutes.
 *   Loki resolves the person from the OrangeCat actor id it stored at
 *   "Login with OrangeCat"; no such person → { linked: false }.
 *
 * Cached in-process per actor for a few minutes: Cat assembles context on
 * every turn, and project state does not move that fast. Never throws —
 * Cat without Loki is Cat as it was.
 */

import { ECOSYSTEM, LOKI_ENDPOINTS } from '@/config/ecosystem';
import { logger } from '@/utils/logger';
import { lokiRailConfigured, postSignedToLoki, type SignedPostOptions } from './signed-post';

export type LokiProjectState = 'working' | 'blocked' | 'idle';

export interface LokiProjectStatus {
  id: string;
  name: string;
  /** The project's page in Loki. */
  lokiUrl: string;
  /** The live site, when it has been deployed. */
  liveUrl: string | null;
  status: LokiProjectState;
  /** awaiting_user | external_dependency | manual_pause, when blocked. */
  blockReason: string | null;
  queueDepth: number;
  currentWork: string | null;
  /** Newest first: success | partial | error | hang | user_abort | timeout. */
  recentOutcomes: string[];
  feedback: { new: number; open: number };
  /** The OrangeCat entities this project was built for. */
  orangecat: Array<{ entityType: string; entityId: string }>;
}

export interface LokiActorStatus {
  /** False when this person has never signed in to Loki with OrangeCat. */
  linked: boolean;
  projects: LokiProjectStatus[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3000;
const MAX_PROJECTS = 25;
const MAX_CACHE_ENTRIES = 500;

const cache = new Map<string, { at: number; value: LokiActorStatus | null }>();

export function lokiActorStatusUrl(): string {
  return (
    process.env.LOKI_ACTOR_STATUS_URL ||
    new URL(LOKI_ENDPOINTS.actorStatus, ECOSYSTEM.loki.siteUrl).toString()
  );
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const isHttp = (v: string | null): v is string => !!v && /^https?:\/\//i.test(v);

function parseProject(raw: unknown): LokiProjectStatus | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const p = raw as Record<string, unknown>;
  const id = str(p.id);
  const name = str(p.name);
  const lokiUrl = str(p.lokiUrl);
  if (!id || !name || !isHttp(lokiUrl)) {
    return null;
  }
  const liveUrl = str(p.liveUrl);
  const status: LokiProjectState =
    p.status === 'working' || p.status === 'blocked' ? p.status : 'idle';
  const feedback = (p.feedback ?? {}) as Record<string, unknown>;
  const links = Array.isArray(p.orangecat) ? p.orangecat : [];
  return {
    id,
    name,
    lokiUrl,
    liveUrl: isHttp(liveUrl) ? liveUrl : null,
    status,
    blockReason: str(p.blockReason),
    queueDepth: num(p.queueDepth),
    currentWork: str(p.currentWork),
    recentOutcomes: Array.isArray(p.recentOutcomes)
      ? p.recentOutcomes.filter((o): o is string => typeof o === 'string').slice(0, 5)
      : [],
    feedback: { new: num(feedback.new), open: num(feedback.open) },
    orangecat: links.flatMap(l => {
      const link = (l ?? {}) as Record<string, unknown>;
      const entityType = str(link.entityType);
      const entityId = str(link.entityId);
      return entityType && entityId ? [{ entityType, entityId }] : [];
    }),
  };
}

/** The response crosses a product boundary: trust only what type-checks. */
export function parseActorStatus(body: string): LokiActorStatus | null {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return null;
  }
  if (!json || typeof json !== 'object' || (json as { ok?: unknown }).ok !== true) {
    return null;
  }
  const { linked, projects } = json as { linked?: unknown; projects?: unknown };
  if (linked !== true) {
    return { linked: false, projects: [] };
  }
  return {
    linked: true,
    projects: (Array.isArray(projects) ? projects : [])
      .map(parseProject)
      .filter((p): p is LokiProjectStatus => !!p)
      .slice(0, MAX_PROJECTS),
  };
}

/**
 * This actor's projects as Loki sees them. null = unknown (rail not armed,
 * Loki down, endpoint not deployed yet) — distinct from { linked: false }.
 */
export async function fetchLokiActorStatus(
  actorId: string,
  opts: SignedPostOptions & { now?: () => number } = {}
): Promise<LokiActorStatus | null> {
  if (!lokiRailConfigured(opts.secret ?? process.env.ORANGECAT_WEBHOOK_SECRET)) {
    return null;
  }
  const now = opts.now ?? Date.now;
  const hit = cache.get(actorId);
  if (hit && now() - hit.at < CACHE_TTL_MS) {
    return hit.value;
  }

  const result = await postSignedToLoki(
    lokiActorStatusUrl(),
    { actorId, issuedAt: new Date(now()).toISOString() },
    { timeoutMs: FETCH_TIMEOUT_MS, ...opts }
  );
  let value: LokiActorStatus | null = null;
  if (result.ok) {
    value = parseActorStatus(result.body);
  } else if (result.status !== 404) {
    // 404 = Loki has not shipped the endpoint yet: expected, not worth a log.
    logger.warn('Loki actor-status unavailable', { error: result.error }, 'LokiActorStatus');
  }

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
    }
  }
  cache.set(actorId, { at: now(), value });
  return value;
}

/** Test seam: forget cached statuses. */
export function clearLokiActorStatusCache(): void {
  cache.clear();
}
