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

export const FREE_VENDORS: readonly FreeVendor[] = [
  {
    id: 'google',
    /**
     * The OpenAI-compatible surface, and it took a real key to establish that
     * it exists. Unkeyed, `/v1beta/openai/models` answers 404 — which is why
     * this vendor sat in REJECTED_VENDORS with the note "the compat layer
     * likely serves /chat/completions without a catalogue". That inference was
     * wrong: with a key the same path answers 200 and lists 56 models. A 404
     * without credentials hid the endpoint; it did not mean it was absent.
     */
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    /**
     * PREFIXED on purpose, and this is the subtle part.
     *
     * The catalogue lists every id with a `models/` prefix — all 56 of them,
     * with no bare form anywhere — while `/chat/completions` accepts BOTH
     * `gemini-flash-latest` and `models/gemini-flash-latest`. Verified
     * 2026-09-15 across max_tokens 64/256/1024: identical answers either way.
     *
     * Configuring the bare id would therefore work perfectly in production and
     * make the catalogue check report it MISSING on every single run — a
     * nightly CAT_MODEL_ROT alarm about a model that serves fine. The prefixed
     * form is the one that is both callable AND findable.
     *
     * `-latest` is an ALIAS rather than a version, which is the same property
     * that makes `openrouter/free` the most rot-resistant entry in that chain:
     * Google retires the id behind it, not the alias. Worth having, because
     * `gemini-2.5-flash` — the id an assistant reaches for from memory — is
     * already refused for new accounts: "no longer available to new users,
     * please update your code to use models/gemini-3.6-flash".
     */
    defaultModel: 'models/gemini-flash-latest',
    modelEnv: 'GEMINI_MODEL',
    note: 'Genuinely free tier — qualification is an active project, no billing account. Free-tier content IS used to improve Google products, which is a deliberate trade for a fallback link.',
  },
];

/**
 * Vendors deliberately NOT listed, so nobody adds them back on a hunch.
 *
 * **GitHub Models — RETIRED.** `models.github.ai` answers 410 on every path,
 * with a body that says so: `github_models_retirement_brownout`, "scheduled
 * retirement brownout". The older `models.inference.ai.azure.com` host no
 * longer resolves. It was the tempting one — a token from an account we
 * already have, no signup — and it is gone. Probed 2026-09-12.
 *
 * **Google AI Studio — no longer rejected; it is in FREE_VENDORS above.**
 * The entry here read "the compat layer likely serves /chat/completions
 * without a catalogue, so its model ids could never be rot-checked". That was
 * an inference from a 404 on an UNKEYED request, and a real key disproved it
 * on 2026-09-15: the same path answers 200 and lists 56 models. Left as a
 * record because the reasoning was sound and still wrong — an unkeyed probe
 * cannot tell "absent" from "hidden behind auth", in either direction.
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
export const REJECTED_VENDORS = ['github', 'cerebras'] as const;

/** The model this vendor should be asked for right now. */
export function vendorModel(v: FreeVendor): string {
  return process.env[v.modelEnv]?.trim() || v.defaultModel;
}

/** Vendors whose key is present, and which are therefore actually usable. */
export function configuredFreeVendors(): FreeVendor[] {
  return FREE_VENDORS.filter(v => Boolean(process.env[v.keyEnv]?.trim()));
}
