/**
 * Cat health probes — live "is the AI layer up?" checks.
 *
 * Hits each configured provider with a minimal ping and classifies the result.
 * Shared by the GET /api/cat/diagnose route AND the Cat's own check_cat_health
 * tool, so the Cat can answer "why isn't my Cat working?" / "what does this
 * provider-failure notification mean?" with live data instead of pointing the
 * user at server logs.
 *
 * No keys, no auth headers, no Bearer strings are ever echoed back — every
 * result is safe to surface to an authenticated user (and to the model).
 */

import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { DEFAULT_FREE_MODEL_ID, getFreeModels } from '@/config/ai-models';
import { CONFIGURED_GROQ_MODEL_IDS, promptFitsGroqOnDemand } from '@/services/ai/groq';
import { webSearch, describeAttempts } from '@bitbaum/ai-kit/web';
import { buildCatSystemPrompt } from './system-prompt';
import { getCatFewShotExamplesText } from './few-shot-examples';

export type ProbeClass =
  'ok' | 'rate_limit' | 'auth' | 'no_key' | 'invalid_key' | 'upstream_err' | 'no_response';

export interface ProbeResult {
  provider: 'groq' | 'openrouter';
  configured: boolean;
  status: number | null;
  class: ProbeClass;
  /** Short text from the upstream error, safe to display. */
  message: string | null;
  /** Header-safe: did the key contain whitespace or control chars (paste artifact)? */
  keyHadJunkChars: boolean;
}

export interface CatHealthReport {
  probes: { groq: ProbeResult; openrouter: ProbeResult };
  /**
   * Registry free-model ids missing from the live OpenRouter catalog
   * (model rot). Empty = no drift; null = catalog check unavailable.
   */
  missingFreeModels: string[] | null;
  /**
   * Configured Groq model ids missing from the live Groq catalog. Empty = no
   * drift; null = check unavailable (no key, or the catalog fetch failed).
   */
  missingGroqModels: string[] | null;
  /**
   * Whether Groq can serve a REAL Cat request, not just a ping. False while the
   * prompt exceeds the on-demand TPM limit — the state in which the old report
   * still said "Cat is healthy".
   */
  groqCanServeCatPrompt: boolean;
  catCanAnswer: boolean;
  /**
   * Can Cat look anything up right now?
   *
   * Its own probe because losing the web is SILENT in a way losing a model is
   * not: a dead provider produces an error a user complains about, whereas a
   * dead search backend produces a fluent answer written from memory. Nobody
   * files a bug about that, which is exactly why it needs a sensor.
   */
  web: WebProbeResult;
  summary: string;
}

export interface WebProbeResult {
  configured: boolean;
  /** A backend answered — whether or not it had results for the probe query. */
  reachable: boolean;
  /** Which backend answered, or the chain that was tried and failed. */
  detail: string;
}

function sanitizeApiKey(key: string): { clean: string; hadJunk: boolean } {
  const clean = key.replace(/[\s\x00-\x1f\x7f]+/g, '');
  return { clean, hadJunk: clean !== key };
}

async function probeProvider(
  provider: 'groq' | 'openrouter',
  envVar: string,
  endpoint: string,
  model: string
): Promise<ProbeResult> {
  const raw = process.env[envVar];
  if (!raw) {
    return {
      provider,
      configured: false,
      status: null,
      class: 'no_key',
      message: `${envVar} env var not set`,
      keyHadJunkChars: false,
    };
  }
  const { clean, hadJunk } = sanitizeApiKey(raw);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${clean}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        temperature: 0,
      }),
    });
    if (res.ok) {
      return {
        provider,
        configured: true,
        status: res.status,
        class: 'ok',
        message: null,
        keyHadJunkChars: hadJunk,
      };
    }
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    const upstreamMessage = body?.error?.message ?? `HTTP ${res.status}`;
    let cls: ProbeClass = 'upstream_err';
    if (res.status === 429) {
      cls = 'rate_limit';
    } else if (res.status === 401 || res.status === 403) {
      cls = 'auth';
    }
    return {
      provider,
      configured: true,
      status: res.status,
      class: cls,
      message: upstreamMessage,
      keyHadJunkChars: hadJunk,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'fetch failed';
    // Treat header-construction errors as invalid_key — these are the
    // paste-artifact bugs (newline / weird trailing char in the env var).
    const cls: ProbeClass = errMsg.includes('Headers.append') ? 'invalid_key' : 'no_response';
    return {
      provider,
      configured: true,
      status: null,
      class: cls,
      message: cls === 'invalid_key' ? 'Authorization header is malformed' : errMsg,
      keyHadJunkChars: hadJunk,
    };
  }
}

export function probeGroq(): Promise<ProbeResult> {
  return probeProvider(
    'groq',
    'GROQ_API_KEY',
    `${PROVIDER_BASE_URLS.groq}/chat/completions`,
    'llama-3.1-8b-instant'
  );
}

export function probeOpenRouter(): Promise<ProbeResult> {
  // Probe with the registry's platform default — a hardcoded id here once
  // drifted from the registry and kept "passing" while chat 404'd (and later
  // kept "failing" after the registry was fixed).
  return probeProvider(
    'openrouter',
    'OPENROUTER_API_KEY',
    `${PROVIDER_BASE_URLS.openrouter}/chat/completions`,
    DEFAULT_FREE_MODEL_ID
  );
}

/**
 * Registry-vs-catalog drift check. OpenRouter retires free models without
 * notice; a registry entry pointing at a retired id makes chat 404 mid-chain.
 * This has bitten prod three times (gpt-oss-120b:free, llama-4-maverick:free,
 * then llama-3.3-70b-instruct:free + llama-4-scout:free on 2026-08-02) —
 * hence a standing probe instead of a fourth manual fix. Uses the public
 * /models endpoint (no key needed). Returns the registry free-model ids that
 * no longer exist upstream; empty array = no drift; null = catalog fetch
 * failed (unknown, not necessarily broken).
 */
export async function probeFreeModelCatalog(): Promise<string[] | null> {
  try {
    const res = await fetch(`${PROVIDER_BASE_URLS.openrouter}/models`);
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    const live = new Set((body.data ?? []).map(m => m.id));
    if (live.size === 0) {
      return null;
    }
    return getFreeModels()
      .map(m => m.id)
      .filter(id => !live.has(id));
  } catch {
    return null;
  }
}

/**
 * The same drift check for Groq. Groq decommissions models exactly as
 * OpenRouter retires free ones, but only OpenRouter was ever watched — so
 * `mixtral-8x7b-32768` and `gemma2-9b-it` stayed in the config long after Groq
 * had removed them, and selecting either was a guaranteed 400. Groq's /models
 * endpoint needs the key; with no key we cannot tell drift from absence, so we
 * return null (unknown) rather than claiming everything is fine.
 */
export async function probeGroqModelCatalog(): Promise<string[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return null;
  }
  try {
    const res = await fetch(`${PROVIDER_BASE_URLS.groq}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as { data?: Array<{ id?: string }> };
    const live = new Set((body.data ?? []).map(m => m.id));
    if (live.size === 0) {
      return null;
    }
    return CONFIGURED_GROQ_MODEL_IDS.filter(id => !live.has(id));
  } catch {
    return null;
  }
}

/**
 * Does Groq's on-demand tier actually admit a REAL Cat request?
 *
 * The provider probe pings with a few tokens, so it returns 200 whenever the
 * key and the service are fine — which is not the question a user is asking
 * when they say "why isn't Cat answering?". Cat's static prompt alone exceeds
 * the on-demand TPM limit, so every real message 413s while the probe stays
 * green. That combination reported "Cat is healthy" on a day when OpenRouter's
 * daily cap was exhausted and Cat could not answer a single person.
 *
 * A health check has to exercise the payload, not just the endpoint.
 */
export function groqCanServeCatPrompt(): boolean {
  return promptFitsGroqOnDemand([
    { content: buildCatSystemPrompt({}) },
    { content: getCatFewShotExamplesText() },
  ]);
}

/**
 * Can Cat see the web?
 *
 * Deliberately treats "a backend answered and had nothing" as HEALTHY. The
 * question here is whether the chain is reachable, not whether one probe query
 * happens to have results — conflating those would page an operator every time
 * an engine had an off day, and a sensor that cries wolf gets muted.
 */
async function probeWeb(): Promise<WebProbeResult> {
  const configured = Boolean(
    process.env.SEARXNG_URL || process.env.BRAVE_SEARCH_API_KEY || process.env.TAVILY_API_KEY
  );
  if (!configured) {
    return {
      configured: false,
      reachable: false,
      detail:
        'No search backend is configured, so Cat cannot look anything up. Set SEARXNG_URL (self-hosted), BRAVE_SEARCH_API_KEY or TAVILY_API_KEY.',
    };
  }
  try {
    const outcome = await webSearch('orangecat', { limit: 1, timeoutMs: 6_000 });
    if (outcome.status === 'could_not_look') {
      return {
        configured: true,
        reachable: false,
        detail: `No search backend answered — ${describeAttempts(outcome.attempts)}.`,
      };
    }
    return {
      configured: true,
      reachable: true,
      detail:
        outcome.status === 'found'
          ? `Search is working (${outcome.provider}).`
          : `Search is reachable but the probe query returned nothing — ${describeAttempts(outcome.attempts)}.`,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      detail: `The search chain threw: ${err instanceof Error ? err.message : 'unknown error'}.`,
    };
  }
}

/** Probe both providers and summarize. */
export async function runCatHealthProbes(): Promise<CatHealthReport> {
  const [groq, openrouter, missingFreeModels, missingGroqModels, web] = await Promise.all([
    probeGroq(),
    probeOpenRouter(),
    probeFreeModelCatalog(),
    probeGroqModelCatalog(),
    probeWeb(),
  ]);
  // Groq being up is not the same as Groq being usable for Cat.
  const groqUsable = groq.class === 'ok' && groqCanServeCatPrompt();
  const drift =
    (missingFreeModels && missingFreeModels.length > 0
      ? ` ⚠️ Registry free models no longer on OpenRouter: ${missingFreeModels.join(', ')} — update src/config/ai-models.ts.`
      : '') +
    (missingGroqModels && missingGroqModels.length > 0
      ? ` ⚠️ Configured Groq models no longer exist: ${missingGroqModels.join(', ')} — update GROQ_MODELS in src/services/ai/groq.ts.`
      : '');
  const oversized =
    groq.class === 'ok' && !groqUsable
      ? ` ⚠️ ${groq.provider} is up but cannot serve Cat: the prompt exceeds its per-minute token limit, so every real message falls through to ${openrouter.provider}.`
      : '';

  // Named separately from the model summary because it is a different
  // question with a different fix: a user reads "Cat is healthy" and assumes
  // it covers everything Cat does.
  const webNote = web.reachable ? '' : ` ⚠️ ${web.detail}`;

  return {
    probes: { groq, openrouter },
    missingFreeModels,
    missingGroqModels,
    groqCanServeCatPrompt: groqUsable,
    catCanAnswer: groqUsable || openrouter.class === 'ok',
    web,
    summary:
      (groqUsable
        ? `Cat is healthy: ${groq.provider} probe returned OK.`
        : openrouter.class === 'ok'
          ? `Primary (${groq.provider}) cannot serve Cat (${groq.class === 'ok' ? 'prompt too large' : groq.class}); fallback (${openrouter.provider}) is healthy.`
          : `Cat cannot answer: groq=${groq.class === 'ok' ? 'prompt too large' : groq.class}, openrouter=${openrouter.class}.`) +
      oversized +
      drift +
      webNote,
  };
}
