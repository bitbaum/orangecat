/**
 * The free pool, as OpenRouter currently serves it — not as a file remembers it.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 * `getFreeModels()` reads `src/config/ai-models.ts`, a list maintained by hand.
 * That list is wrong on a schedule. On 2026-09-13 a health check on its very
 * first run found two entries OpenRouter had stopped serving, and the repair was
 * a pull request: edit, review, CI, deploy. Until it landed, the model picker
 * offered users two models that answer 404.
 *
 * The vendor publishes the truth continuously. `resolveChain` from ai-kit reads
 * it, so rot can be routed around in the process rather than in a commit.
 *
 * ── Why a cache and not an await ─────────────────────────────────────────────
 * The one caller, `orderedOpenRouterFreeModels`, is synchronous and sits on the
 * hot path of every chat message. Making it async would ripple through the
 * provider builder and the chat route for a value that changes a few times a
 * month. So resolution happens in the BACKGROUND and this module hands back the
 * newest answer it has.
 *
 * The consequence is deliberate and worth stating: the first request after a
 * cold start gets the registry list, exactly as it does today. This is an
 * improvement that arrives a few seconds in, never a dependency the first
 * request can be blocked or broken by.
 *
 * ── Why the registry still leads ─────────────────────────────────────────────
 * Registry ids carry metadata the auto-router needs to CHOOSE between them, and
 * were vetted by hand. Discovered ids have neither. So discovery only ever
 * extends the tail — it adds places to fall back to, and never changes which
 * model a healthy request gets. A user sees no difference until the models they
 * would have got are all failing, which is precisely when they want more.
 */

import { resolveChain, type ProviderResolution, type Provider } from '@bitbaum/ai-kit';
import { getFreeModels } from '@/config/ai-models';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { logger } from '@/utils/logger';

/** How long a resolution is trusted before a refresh is triggered. */
const TTL_MS = 60 * 60 * 1000;

/**
 * Ids appended beyond the registry's own.
 *
 * Capped because the chain is walked IN ORDER on failure: an unbounded tail
 * turns one congested minute at OpenRouter into dozens of sequential requests
 * before the user sees anything.
 */
const MAX_DISCOVERED = 6;

type Pool = {
  /** Registry ids the vendor still lists. */
  kept: string[];
  /** Live ids the registry never named, for the tail. */
  discovered: string[];
  /** Registry ids the vendor no longer lists — already routed around. */
  dropped: string[];
  at: number;
};

let pool: Pool | null = null;
let inFlight: Promise<void> | null = null;

/** The OpenRouter row, described in ai-kit's vocabulary. Models are DERIVED. */
function openRouterProvider(): Provider {
  return {
    id: 'openrouter',
    baseUrl: PROVIDER_BASE_URLS.openrouter,
    keyEnv: 'OPENROUTER_API_KEY',
    models: getFreeModels().map(m => m.id),
    // Only used by ai-kit's rationing, which this path does not drive.
    dailyTokens: 0,
    routed: true,
  };
}

function record(r: ProviderResolution): void {
  // Rule from ai-kit: an unreadable catalogue keeps the declaration and proves
  // nothing. Caching that would be caching ignorance — and worse, it would
  // reset the TTL, so a spell of vendor trouble could freeze a stale answer in
  // place for an hour. Leave the previous pool alone and retry next time.
  if (r.unverified) {
    logger.warn(
      'free pool unresolved; keeping the registry list',
      { provider: r.provider },
      'FreeModelPool'
    );
    return;
  }

  pool = {
    kept: r.kept,
    discovered: r.discovered,
    dropped: r.dropped,
    at: Date.now(),
  };

  // Rot is worth a line in the log even though it no longer breaks anything:
  // silently healing it forever would hide that the registry needs a tidy.
  if (r.dropped.length > 0) {
    logger.warn(
      'registry lists models OpenRouter no longer serves; routed around',
      { dropped: r.dropped, stillServing: r.kept.length },
      'FreeModelPool'
    );
  }
  for (const e of r.expiring) {
    logger.warn(
      'vendor published an end date for a model in the free pool',
      { model: e.model, endsOn: e.on },
      'FreeModelPool'
    );
  }
}

/** Resolve once; never throws, never runs twice concurrently. */
async function refresh(): Promise<void> {
  if (inFlight) {
    return inFlight;
  }
  inFlight = (async () => {
    try {
      const [r] = await resolveChain([openRouterProvider()], {
        discover: true,
        maxDiscovered: MAX_DISCOVERED,
        // Defaults, stated because they are the money-safety rule: only models
        // the vendor PRICES AT ZERO, that emit text, and that declare tools.
        require: { free: true, textOnly: true, tools: true },
      });
      if (r) {
        record(r);
      }
    } catch (error) {
      // A resolution failure must never affect a chat request. The registry
      // list is the floor, and it is exactly what runs today.
      logger.warn(
        'free pool resolution failed; keeping the registry list',
        { error: error instanceof Error ? error.name : 'unknown' },
        'FreeModelPool'
      );
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Kick off a refresh when the cache is missing or stale. Never awaited. */
function refreshIfStale(): void {
  if (pool && Date.now() - pool.at < TTL_MS) {
    return;
  }
  void refresh();
}

/**
 * The free pool to try, best first.
 *
 * `registryIds` is what `getFreeModels()` produced, already ordered by the
 * caller's own preference — that order is preserved exactly. Resolution may
 * REMOVE an id the vendor has retired, and APPEND ids it did not know about.
 * It never reorders what remains.
 */
export function resolveFreePool(registryIds: string[]): string[] {
  refreshIfStale();

  const current = pool;
  if (!current) {
    return registryIds;
  }

  const gone = new Set(current.dropped);
  const alive = registryIds.filter(id => !gone.has(id));

  // Never hand back nothing. If resolution somehow contradicts every id the
  // caller has, the registry list is still the better answer than an empty
  // chain: a 404 can be retried past, a missing chain cannot.
  const head = alive.length > 0 ? alive : registryIds;

  const extra = current.discovered.filter(id => !head.includes(id));
  return [...head, ...extra];
}

/** What the last resolution found. For health reporting and tests. */
export function freePoolStatus(): {
  resolved: boolean;
  kept: number;
  discovered: number;
  dropped: string[];
  ageMs: number | null;
} {
  return {
    resolved: pool !== null,
    kept: pool?.kept.length ?? 0,
    discovered: pool?.discovered.length ?? 0,
    dropped: pool?.dropped ?? [],
    ageMs: pool ? Date.now() - pool.at : null,
  };
}

/** Test seam: forget everything resolved so far. */
export function __resetFreePool(): void {
  pool = null;
  inFlight = null;
}
