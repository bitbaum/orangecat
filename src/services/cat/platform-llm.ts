/**
 * Shared platform-LLM call for structured (JSON) Cat features. Mirrors the
 * provider selection the offer-engine established (Groq preferred for short/fast
 * work, OpenRouter free pool for long-form) and returns the raw model content
 * string, or null on any failure so callers degrade gracefully.
 *
 * Free-pool only — needs GROQ_API_KEY and/or OPENROUTER_API_KEY on the box
 * (already set; platform Cat runs on them). Never touches Cat Credits / NWC.
 */

import { complete, linkId, ChainExhaustedError, type Link } from '@bitbaum/ai-kit';
import { logger } from '@/utils/logger';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';

// Capable, JSON-reliable defaults. Groq is fast + cheap for short work; the
// registry's free OpenRouter default is the fallback. Free model ids rot —
// the pinned llama-4-maverick:free this file once carried 404'd too. The
// registry is now the one place ids live, guarded by the free-model catalog
// probe (health-probes.ts), so drift is detected there instead of re-pinned
// here.
/**
 * Groq's general-purpose model.
 *
 * `llama-3.3-70b-versatile` was pinned here and STOPPED BEING SERVED. Groq
 * answered 404 for it, every callPlatformJson caller returned null, and because
 * the failure was logged at warn and swallowed by callers that "degrade
 * gracefully", eight features degraded gracefully into doing nothing: the offer
 * engine, both writing engines, prompt suggestions, platform feedback, image
 * suggestions, the voice intent router, and the Cat's replies. Verified against
 * the live API on 2026-08-26 — Groq served 14 models and that was not among
 * them.
 *
 * Model ids rot. This is the fifth time in this fleet, and the comment below
 * already said so about OpenRouter. The durable answer is not a better id, it
 * is the failover underneath and `npm run check:ai-models`, which asks each
 * provider whether it still serves what we pinned.
 */
const GROQ_MODEL = 'openai/gpt-oss-120b';
const OPENROUTER_MODEL = DEFAULT_FREE_MODEL_ID;

/**
 * Models that reject `response_format: { type: 'json_object' }` outright.
 *
 * Groq's `openai/gpt-oss-120b` answers 400 `json_validate_failed` with an EMPTY
 * `failed_generation` for EVERY request carrying the flag — verified against
 * the live API on 2026-09-12 with a prompt as small as `Return JSON: {"ok":true}`.
 * The same model, same prompt, without the flag returns valid JSON. So the flag
 * is not a stricter mode here, it is an outage: in 24h of production traffic
 * every single Groq attempt died on it and every structured Cat feature was
 * served by OpenRouter instead, one wasted round-trip later.
 *
 * Seeded with what is proven, and added to at runtime, so the next model that
 * starts rejecting the flag costs one failure rather than every call until
 * somebody reads the logs.
 */
const JSON_MODE_UNSUPPORTED = new Set<string>([`groq:${GROQ_MODEL}`]);

function linkKey(link: Link): string {
  return `${link.provider.id}:${link.model}`;
}

function rejectsJsonMode(link: Link): boolean {
  return JSON_MODE_UNSUPPORTED.has(linkKey(link));
}

/** Groq says `json_validate_failed`; other vendors name the flag they refused. */
function isJsonModeRejection(message: string): boolean {
  return /json_validate_failed|response_format/i.test(message);
}

/** Consecutive links that agree on whether the JSON flag can be sent at all. */
function jsonModeRuns(chain: Link[]): Array<{ jsonMode: boolean; links: Link[] }> {
  const runs: Array<{ jsonMode: boolean; links: Link[] }> = [];
  for (const link of chain) {
    const jsonMode = !rejectsJsonMode(link);
    const last = runs[runs.length - 1];
    if (last && last.jsonMode === jsonMode) {
      last.links.push(link);
    } else {
      runs.push({ jsonMode, links: [link] });
    }
  }
  return runs;
}

/** Did this chain failure include a model refusing `response_format` itself? */
function mentionsJsonModeRejection(err: unknown): boolean {
  if (err instanceof ChainExhaustedError) {
    return err.failures.some(f => isJsonModeRejection(f.message));
  }
  return isJsonModeRejection(String(err));
}

/**
 * Every link's own failure, not just the last status: "lastStatus 429" cannot
 * tell a rotted id at one vendor from a spent day at the other.
 */
function describeFailure(err: unknown): string[] | string {
  return err instanceof ChainExhaustedError ? err.failures.map(f => f.message) : String(err);
}

export interface PlatformJsonOpts {
  temperature?: number;
  maxTokens?: number;
  /** Long-form (article bodies): prefer OpenRouter for a larger output budget. */
  longform?: boolean;
  /**
   * Abort after this many ms. Set it on anything a user is waiting behind — the
   * free pool has no latency guarantee, and callers here all degrade gracefully
   * to a null return. Omitted = wait indefinitely (background/batch callers).
   */
  timeoutMs?: number;
}

/**
 * The two links, in `ai-kit`'s shape, built from THIS repo's model registry.
 *
 * Deliberately not `freeChain()`. The ids above come from `@/config/ai-models`,
 * which the free-model catalog probe in health-probes.ts watches, and this repo
 * keeps its own registry on purpose. The engine is adopted for the REQUEST, not
 * to take over which models orangecat serves.
 *
 * Groq first — fast, and handles long-form JSON inside the free TPM budget.
 * OpenRouter after it, and that ORDERING IS NOT THE POINT: what matters is that
 * there is a second entry at all. This used to return the FIRST provider whose
 * key existed and stop, so when Groq's pinned model stopped being served there
 * was no path out — a dead id took every platform-LLM feature down with it and
 * OpenRouter sat there configured and unused.
 */
function resolveChain(): { chain: Link[]; env: Record<string, string> } {
  const chain: Link[] = [];
  const env: Record<string, string> = {};

  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (groqKey) {
    env.GROQ_API_KEY = groqKey;
    chain.push({
      provider: {
        id: 'groq',
        baseUrl: PROVIDER_BASE_URLS.groq,
        keyEnv: 'GROQ_API_KEY',
        models: [GROQ_MODEL],
        // Only feeds ai-kit's rationing helpers, which this file does not call.
        // Stated low rather than invented: a generous guess produces the exact
        // wall the rationing exists to prevent.
        dailyTokens: 0,
      },
      model: GROQ_MODEL,
    });
  }

  if (openRouterKey) {
    env.OPENROUTER_API_KEY = openRouterKey;
    chain.push({
      provider: {
        id: 'openrouter',
        baseUrl: PROVIDER_BASE_URLS.openrouter,
        keyEnv: 'OPENROUTER_API_KEY',
        models: [OPENROUTER_MODEL],
        dailyTokens: 0,
        // Routed ids: `:free` is the difference between free routing and a
        // per-call charge.
        routed: true,
      },
      model: OPENROUTER_MODEL,
    });
  }

  return { chain, env };
}

/**
 * Whether any platform AI provider is configured at all.
 *
 * Callers that owe the user a specific "not configured" explanation (form
 * prefill's `provider_not_configured` code, with its settings link) need to
 * tell this apart from "configured but down" — callPlatformJson collapses both
 * into null.
 */
export function hasPlatformProviders(): boolean {
  return resolveChain().chain.length > 0;
}

/**
 * Call the platform LLM with a system+user prompt and JSON response mode.
 * Returns the raw content string (expected to be JSON) or null.
 *
 * ── What `complete()` fixed here ─────────────────────────────────────────────
 *
 * AN EMPTY 200 WAS AN ANSWER. `json.choices?.[0]?.message?.content ?? null`
 * looks like it guards, and does not: `??` only catches null/undefined, so an
 * empty STRING was returned as the model's output. Worse, the loop `return`ed
 * on the first `response.ok`, so an empty completion never fell through to
 * OpenRouter — it went straight to `parseJsonLoose('')`, which returns null,
 * and eight features "degraded gracefully" into doing nothing. That is the same
 * silence the rotted `llama-3.3-70b-versatile` id caused, from a different
 * cause, and it would not have shown up in the logs at all.
 *
 * A 429 WAS A STATUS CODE. The three kinds share it and want opposite
 * responses; only the response body separates them. `complete()` reads it, so a
 * DAILY cap now condemns that vendor (its other models draw on the same
 * exhausted org-wide budget) and a SIZE cap ends the walk rather than demoting
 * to a smaller ceiling.
 *
 * EVERY LINK'S FAILURE IS NAMED, not just `lastStatus`. "every provider failed,
 * lastStatus 429" cannot tell a rotted id at Groq from a spent day at
 * OpenRouter.
 */
export async function callPlatformJson(
  system: string,
  user: string,
  opts: PlatformJsonOpts = {}
): Promise<string | null> {
  const { chain, env } = resolveChain();
  if (chain.length === 0) {
    logger.warn('platform-llm: no platform AI key configured', {}, 'PlatformLLM');
    return null;
  }

  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
  const maxTokens = opts.maxTokens ?? (opts.longform ? 3000 : 1400);
  const temperature = opts.temperature ?? 0.6;

  const attempt = (jsonMode: boolean, links: Link[] = chain) =>
    complete({
      chain: links,
      env,
      messages,
      temperature,
      maxTokens,
      ...(opts.timeoutMs ? { timeoutMs: opts.timeoutMs } : {}),
      ...(jsonMode ? { extraBody: { response_format: { type: 'json_object' } } } : {}),
      // OpenRouter reads this for app attribution in its public rankings.
      // Harmless at Groq, which ignores unknown headers.
      extraHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://orangecat.ch',
      },
      onLinkFailure: (link, error) => {
        // A 404 means the model id no longer exists, which is a CONFIGURATION
        // fault rather than a hiccup: it will fail identically until someone
        // changes the constant. warn was too quiet — it degraded eight features
        // to silence for as long as nobody read the logs.
        if (/: 404\b/.test(error.message)) {
          logger.error(
            'platform-llm: model no longer served — the pinned id has rotted',
            { link: linkId(link) },
            'PlatformLLM'
          );
        } else {
          // A model that refuses the JSON flag refuses it every time. Record it
          // so the next call does not spend a round-trip proving it again.
          if (isJsonModeRejection(error.message)) {
            JSON_MODE_UNSUPPORTED.add(linkKey(link));
          }
          logger.warn(
            'platform-llm: model call failed',
            { link: linkId(link), error: error.message },
            'PlatformLLM'
          );
        }
      },
    });

  // The flag is a PER-MODEL capability, not a chain-wide one. Sending it to a
  // model that refuses it is a guaranteed 400 in front of a user-facing
  // feature; withholding it from a model that supports it throws away the
  // strictness that makes the answer parseable. So the chain is walked in runs
  // that agree on the flag: Groq answers without it, and if Groq is out, the
  // OpenRouter fallback still gets it.
  const runs = jsonModeRuns(chain);
  const failures: unknown[] = [];

  for (const run of runs) {
    try {
      return (await attempt(run.jsonMode, run.links)).text;
    } catch (err) {
      failures.push(err);
      // A rejection we had not recorded yet: the hook above has just learned
      // it, so every LATER call is already correct. Rescue this one too, once,
      // rather than making the user pay for the discovery.
      if (run.jsonMode && mentionsJsonModeRejection(err)) {
        try {
          return (await attempt(false, run.links)).text;
        } catch (retryErr) {
          failures.push(retryErr);
        }
      }
    }
  }

  logger.error(
    'platform-llm: every provider failed',
    { links: chain.length, failures: failures.map(describeFailure) },
    'PlatformLLM'
  );
  return null;
}

/**
 * Defensive JSON parse for model output: tolerates ```json fences and leading
 * prose by extracting the first balanced object/array. Returns null on failure.
 */
export function parseJsonLoose<T = unknown>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  const cleaned = raw
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first {...} or [...] span.
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}
