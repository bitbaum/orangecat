/**
 * Shared platform-LLM call for structured (JSON) Cat features. Walks the
 * platform's ONE serving chain (`servingChain()`, the same one the Cat answers
 * from) and returns the raw model content string, or null on any failure so
 * callers degrade gracefully.
 *
 * Free-pool only — uses whichever vendor keys are set on the box. Never touches
 * Cat Credits / NWC.
 */

import { complete, linkId, usableChain, ChainExhaustedError, type Link } from '@bitbaum/ai-kit';
import { logger } from '@/utils/logger';
import { servingChain } from '@/services/cat/provider-catalog';

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
// Seeded with the one refusal measured live; any other model that refuses the
// flag is learned on first contact by the onLinkFailure hook below.
const JSON_MODE_UNSUPPORTED = new Set<string>(['groq:openai/gpt-oss-120b']);

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

/**
 * Record which link actually answered.
 *
 * Failures were logged and wins were not, so nothing could tell a provider
 * that answers every time from one that has answered nothing in days — the
 * fallback chain served both cases identically. Groq spent days answering 400
 * to every structured call with no symptom beyond a slightly slower reply.
 * `CompleteResult.id` already carries `provider/model`, so the win costs one
 * line, and the box sweep (loki: ai-provider-check.sh) divides the two.
 *
 * Nothing about the prompt or the answer is logged — only which link served.
 */
function served(result: { text: string; id: string }): string {
  // always: production logs at warn, and the box sweep that divides wins by
  // losses must be able to see the wins.
  logger.info('platform-llm: model call served', { link: result.id }, 'PlatformLLM', {
    always: true,
  });
  return result.text;
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
 * The platform's serving chain, as links, with the keys they need.
 *
 * This used to build its OWN two-link chain — Groq, then OpenRouter — beside
 * the one the Cat serves from. It drifted the way a second copy does: no
 * Gemini, which holds this platform's own quota, and OpenRouter's free pool
 * (50 requests a day shared by every app on the box) as the only fallback, so
 * the ~9 JSON features behind this file went quiet whenever Groq did. The same
 * defect was fixed for companions in #1238. `servingChain()` is built from this
 * repo's own model registry (the thing this file once kept separate on purpose)
 * and is the one the rot check watches, so there is nothing left to keep apart.
 *
 * `prompt` lets the chain order OpenRouter's free pool by what fits.
 */
function resolveChain(prompt = ''): { chain: Link[]; env: Record<string, string> } {
  const chain = usableChain(servingChain(prompt || undefined));
  const env: Record<string, string> = {};
  for (const link of chain) {
    const key = process.env[link.provider.keyEnv]?.trim();
    if (key) {
      env[link.provider.keyEnv] = key;
    }
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
  const { chain, env } = resolveChain(user);
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
      return served(await attempt(run.jsonMode, run.links));
    } catch (err) {
      failures.push(err);
      // A rejection we had not recorded yet: the hook above has just learned
      // it, so every LATER call is already correct. Rescue this one too, once,
      // rather than making the user pay for the discovery.
      if (run.jsonMode && mentionsJsonModeRejection(err)) {
        try {
          return served(await attempt(false, run.links));
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
