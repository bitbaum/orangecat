/**
 * Free AI vendors, described once.
 *
 * Reliability here does not come from one good vendor. Every one of them
 * retires models without notice, reclassifies a free model as paid, and rations
 * by a per-minute budget you only discover by exceeding it — all three have
 * happened to this codebase. What survives that is INDEPENDENT BUCKETS: several
 * vendors, each with its own daily allowance, so one being spent is a failover
 * rather than an outage.
 *
 * Each entry is inert until its key exists. `buildPlatformProviders` skips a
 * vendor with no key, which means adding one here is safe before the account
 * exists and live the moment a key lands in the environment — no deploy.
 *
 * ON THE MODEL IDS BELOW: they are the best known at the time of writing and
 * they WILL rot, because that is what this file is about. Two things make that
 * survivable rather than silent. `modelsEnv` replaces them at call time, so
 * routing around a retirement needs an env var and not a release. And
 * `orangecatChain()` feeds every vendor here to the shared catalogue check, so
 * the first run with a key says plainly which ids the vendor no longer lists.
 *
 * ON THE ENDPOINTS: every entry has been probed unkeyed, and only entries whose
 * host answers (401/403 — "exists, wants auth") are listed. The first draft of
 * this file carried three vendors written from memory; two were wrong, and one
 * of those was a product being retired. A file about model rot is not exempt
 * from it — see REJECTED_VENDORS below for what was removed and why.
 *
 * Groq and OpenRouter are deliberately NOT here: they are wired with their own
 * capacity accounting (TPM pre-flight, free-pool metering) that these do not
 * have yet. This file is for the plain OpenAI-compatible ones.
 */

export interface FreeVendor {
  id: string;
  /** OpenAI-compatible base url, no trailing slash. */
  baseUrl: string;
  /** Env var holding the key. Absent = vendor skipped, not an error. */
  keyEnv: string;
  /** Best-known free model. Validated by the catalogue check, not trusted. */
  defaultModel: string;
  /** Env var replacing `defaultModel` at call time, for routing around rot. */
  modelEnv: string;
  /** Why this vendor is worth a link. */
  note: string;
}

/**
 * EMPTY, and that is the honest state rather than a gap.
 *
 * No third vendor has yet cleared the bar this file sets: a free tier that a
 * real key can actually serve from. Cerebras was listed here and did not — see
 * REJECTED_VENDORS. An empty list costs nothing (every consumer already skips
 * a vendor with no key) and is far cheaper than a entry that turns every
 * fallback attempt into a guaranteed refusal.
 */
export const FREE_VENDORS: readonly FreeVendor[] = [];

/**
 * Vendors deliberately NOT listed, so nobody adds them back on a hunch.
 *
 * **GitHub Models — RETIRED.** `models.github.ai` answers 410 on every path,
 * with a body that says so: `github_models_retirement_brownout`, "scheduled
 * retirement brownout". The older `models.inference.ai.azure.com` host no
 * longer resolves. It was the tempting one — a token from an account we
 * already have, no signup — and it is gone. Probed 2026-09-12.
 *
 * **Google AI Studio — unverified, not rejected.** The native
 * `/v1beta/models` answers 403 (exists, wants auth) but the OpenAI-compatible
 * `/v1beta/openai/models` answers 404, so the compat layer likely serves
 * `/chat/completions` without a catalogue. That means its model ids could
 * never be rot-checked, which is the one property making a best-known id safe
 * to carry. Worth adding once someone with a key confirms the chat path and
 * how to list its models — a genuinely generous free tier, but not on a guess.
 */
/**
 * **Cerebras — NOT FREE.** Listed here as a free vendor on the strength of an
 * unkeyed 403 and a note that claimed "free tier with per-minute budgets larger
 * than Groq". Both were wrong, and a real key settled it on 2026-09-14:
 *
 *   cerebras.ai/pricing, Developer tier:
 *     "Self-serve pay-as-you-go with free $5 credit to start"
 *     gpt-oss-120b  $0.35/M in, $0.75/M out
 *     qwen-3.8-27b  $0.99/M in, $1.49/M out
 *
 *   GET  /v1/models            -> 200, lists gemma-4-31b, gpt-oss-120b, qwen-3.8-27b
 *   POST /v1/chat/completions  -> 402 {"code":"payment_required",
 *                                      "message":"Payment required to access this
 *                                      resource. Visit your billing tab."}
 *
 * So the catalogue answers while every completion is refused — the exact shape
 * that makes an unkeyed probe look like a pass. 403-without-a-key established
 * only that the host exists; it never established that anyone can be served.
 *
 * The pinned id was wrong too: `llama-3.3-70b` is not in the live catalogue
 * above, so even a funded account would have 404'd on the first call.
 *
 * Add it back only as a PAID vendor with metering, never to this list. This
 * chain exists for users with no key and no credits, and a link that bills is a
 * link that can only 402 — the same failure #1000 fixed for Groq.
 */
export const REJECTED_VENDORS = ['github', 'google', 'cerebras'] as const;

/** The model this vendor should be asked for right now. */
export function vendorModel(v: FreeVendor): string {
  return process.env[v.modelEnv]?.trim() || v.defaultModel;
}

/** Vendors whose key is present, and which are therefore actually usable. */
export function configuredFreeVendors(): FreeVendor[] {
  return FREE_VENDORS.filter(v => Boolean(process.env[v.keyEnv]?.trim()));
}
