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
    id: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    defaultModel: 'llama-3.3-70b',
    modelEnv: 'CEREBRAS_MODEL',
    note: 'Free tier with per-minute budgets larger than Groq, so it can carry a whole conversation rather than only its opening.',
  },
  {
    id: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GOOGLE_AI_API_KEY',
    defaultModel: 'gemini-2.5-flash',
    modelEnv: 'GOOGLE_AI_MODEL',
    note: 'The most generous free allowance of the three, via the OpenAI-compatible endpoint.',
  },
  {
    id: 'github',
    baseUrl: 'https://models.github.ai/inference',
    keyEnv: 'GITHUB_MODELS_TOKEN',
    defaultModel: 'openai/gpt-4o-mini',
    modelEnv: 'GITHUB_MODELS_MODEL',
    note: 'Needs no new account — a token from the GitHub account this repo already uses.',
  },
];

/** The model this vendor should be asked for right now. */
export function vendorModel(v: FreeVendor): string {
  return process.env[v.modelEnv]?.trim() || v.defaultModel;
}

/** Vendors whose key is present, and which are therefore actually usable. */
export function configuredFreeVendors(): FreeVendor[] {
  return FREE_VENDORS.filter(v => Boolean(process.env[v.keyEnv]?.trim()));
}
