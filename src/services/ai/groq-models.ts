/**
 * Which Groq models this app serves, what they cost in budget terms, and
 * whether a given prompt will be accepted at all.
 *
 * Split out of groq.ts on 2026-09-11 (the service file passed its 500-line
 * limit): the registry, the caps and the fit predicate are read by callers
 * that never touch the HTTP client — the orchestrator's pre-flight, the health
 * probe, the capacity endpoint — and they belong together, away from the
 * transport.
 */
import { estimateMessagesTokens, getGroqTpmLimit } from '@/services/ai/groq-capacity';

// Groq's best free models.
//
// Both previous entries were gone: Groq withdrew the whole llama-3.x family, so
// this registry listed two models and served zero, and DEFAULT_GROQ_MODEL below
// pointed at one of them. platform-llm.ts was repaired for exactly this on
// 2026-08-26 — its comment records eight features "degrading gracefully" into
// doing nothing. This file is the same outage, in the half nobody looked at.
//
// Figures are Groq's own, from GET /models on 2026-08-27. The old entries
// claimed 128000/32768 and 128000/8192 for ids that no longer existed.
const GROQ_MODELS = {
  // The platform baseline: capable, tools + JSON.
  'openai/gpt-oss-120b': { name: 'GPT OSS 120B', contextWindow: 131072, maxOutputTokens: 65536 },
  // Same context, smaller and faster — more headroom under Groq's daily cap.
  'openai/gpt-oss-20b': { name: 'GPT OSS 20B', contextWindow: 131072, maxOutputTokens: 65536 },
} as const;

/**
 * Configured Groq model ids, for the catalog-drift probe.
 *
 * Groq decommissions models without notice, exactly as OpenRouter retires free
 * ones. `mixtral-8x7b-32768` and `gemma2-9b-it` sat here long after Groq had
 * removed them (both answered 400 "has been decommissioned" when measured on
 * 2026-08-06) — selecting either was a guaranteed failure. OpenRouter got a
 * standing probe after its third rot incident; Groq had none, which is why this
 * drift went unnoticed. See probeGroqModelCatalog in services/cat/health-probes.
 */
export const CONFIGURED_GROQ_MODEL_IDS = Object.keys(GROQ_MODELS);

/**
 * Default Groq model — the platform baseline a free (non-BYOK) user gets.
 *
 * This was `llama-3.3-70b-versatile`, itself an upgrade from
 * `llama-3.1-8b-instant`. Groq retired both, so the default and its documented
 * alternative died on the same day — but the reasoning survives the ids: pick
 * the most capable free model, since we cannot buy a better one (no fiat rails
 * to pay providers), and accept that a larger model exhausts the daily cap
 * sooner because the chain rolls to OpenRouter when it does. gpt-oss-120b is
 * the capable end of what Groq serves free; gpt-oss-20b is the headroom option.
 *
 * GROQ_MAX_OUTPUT_TOKENS stays at 2048 to fit Groq's per-minute TPM bucket
 * (reserved max_tokens counts against it), whatever the model would allow.
 *
 * To dial back to the smaller model without a deploy, set GROQ_DEFAULT_MODEL.
 */
/**
 * The Groq model the PLATFORM chain offers a user with no key of their own.
 *
 * MUST be a model the registry marks free, and that is the whole point. This
 * used to be `DEFAULT_GROQ_MODEL` — `openai/gpt-oss-120b` — which the registry
 * tiers as `economy`, so `isPlatformMeteredModel()` bills it. The first link of
 * the free chain therefore answered 402 INSUFFICIENT_CREDITS for every free
 * user and the chain always fell through to OpenRouter. Measured on production
 * over 30 days: 49 of 55 assistant messages came from OpenRouter, ONE from
 * Groq.
 *
 * The cost was not just a dead link. OrangeCat holds its OWN Groq key, while
 * its OpenRouter key is shared by seven apps on this box — so the chain skipped
 * dedicated capacity to crowd onto a 50-requests-a-day pool split seven ways,
 * which is why the nightly eval kept finding it empty four hours after the
 * midnight reset.
 *
 * `DEFAULT_GROQ_MODEL` stays as it is for BYOK users: they face no paywall, so
 * they should keep the capable model. Two defaults, deliberately.
 */
export const PLATFORM_GROQ_MODEL: keyof typeof GROQ_MODELS =
  (process.env.PLATFORM_GROQ_MODEL as keyof typeof GROQ_MODELS | undefined) ?? 'openai/gpt-oss-20b';

export const DEFAULT_GROQ_MODEL: keyof typeof GROQ_MODELS =
  (process.env.GROQ_DEFAULT_MODEL as keyof typeof GROQ_MODELS | undefined) ?? 'openai/gpt-oss-120b';

/**
 * Default max output tokens for chat completions.
 *
 * Groq's free tier limits tokens-PER-MINUTE (e.g. 6000 TPM for
 * llama-3.1-8b-instant), and the *reserved* `max_tokens` counts against that
 * bucket up-front — so defaulting to the model's full 8192 output capability
 * makes every request exceed TPM and 429 (which silently fell the Cat back to
 * OpenRouter on every message). Callers that need more pass `maxTokens`
 * explicitly.
 *
 * Lowered 2048 -> 1024 on 2026-08-06. The reservation is pure prompt budget
 * spent up-front: at ~4.5 chars/token, 1024 fewer reserved output tokens buys
 * ~4,600 more characters of prompt, roughly halving the gap between Cat's
 * prompt and the on-demand ceiling. 1024 tokens is still a long chat reply
 * (~4,500 characters), and every caller that genuinely needs more — the
 * writing engine and reviser — already passes `maxTokens` explicitly, so this
 * narrows nothing but the default.
 */
export const GROQ_CHAT_MAX_TOKENS = 1024;

/**
 * Groq's on-demand service tier (the platform org's tier) hard-rejects any
 * single request whose tokens exceed its per-minute limit with HTTP 413 —
 * measured against the platform key 2026-08-02: "Limit 12000". Once a Cat
 * prompt outgrows this (memories + history + page excerpt), EVERY message
 * pays a guaranteed-failing Groq round-trip before falling back.
 *
 * 12000 is also the best on this key: measured 2026-08-06, llama-3.1-8b-instant
 * is 6000 and openai/gpt-oss-{20b,120b} are 8000. There is no higher-TPM model
 * to escape to — the prompt has to shrink.
 *
 * It is a ROLLING per-minute budget, not a per-request ceiling: back-to-back
 * requests in the same minute share it, so a second call can 413 on a payload
 * the first one accepted. Measure fit with a single call in a drained window.
 */
export const GROQ_ON_DEMAND_TPM_LIMIT = 12_000;

/**
 * Pre-flight fit check for the on-demand tier. The chars/4 estimate slightly
 * over-counts, so borderline prompts skip a little early instead of 413ing —
 * callers only invoke this when another chain link can serve the request.
 *
 * The real ratio for Cat's own prompt is ~4.5 chars/token, measured twice
 * against the live API on 2026-08-06 (60,747 chars → 13,827 prompt tokens;
 * 54,444 → 12,119). An earlier comment here claimed ~6, which made the prompt
 * look 52% over budget when it is ~39% over — the diet target was wrong by a
 * third. Do not restate this ratio from memory; measure it.
 * The reserved output budget counts against the same TPM bucket, so it's
 * part of the estimate.
 */
export function promptFitsGroqOnDemand(
  messages: Array<{ content: string | null | undefined }>,
  model: string = DEFAULT_GROQ_MODEL,
  maxTokens: number = GROQ_CHAT_MAX_TOKENS
): boolean {
  // The cap is per model and learned live (a 413 body names it); the estimate
  // errs high on purpose — under-estimating is how the 413 got through.
  return estimateMessagesTokens(messages) + maxTokens <= getGroqTpmLimit(model);
}

/** Model metadata, for callers that need a context window or output ceiling. */
export function getGroqModel(
  model: string
): { name: string; contextWindow: number; maxOutputTokens: number } | null {
  return (
    (
      GROQ_MODELS as Record<
        string,
        { name: string; contextWindow: number; maxOutputTokens: number }
      >
    )[model] ?? null
  );
}
