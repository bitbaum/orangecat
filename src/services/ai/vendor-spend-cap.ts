/**
 * A strict daily cap on what the PLATFORM's own key spends at a vendor.
 *
 * On 2026-11-12 the Gemini API was switched off to stop the spend, and every
 * bot on the shared pool stopped answering with it. The owner's rule: a vendor
 * may be on only with a strict spending cap. This is that cap, enforced on
 * every path that calls the vendor with the platform's key: the chat clients
 * (cappedService), the Cat's tool loop and the health probe (reservePlatformCall).
 *
 * The count lives in the database (reserve_vendor_call, migration
 * 20261112200500), taken BEFORE the call, atomically, per UTC day. A call is
 * refused when the database cannot be asked: an unknown count is never room.
 *
 * Calls, not tokens: a call's cost is bounded by its prompt and its output
 * cap, and it can be counted before it is made. A token count is known only
 * afterwards, when the money is spent.
 *
 * A person's own key is never counted: they pay for it themselves.
 */
import { getAdminClient } from '@/lib/supabase/admin';
import { sanitizeApiKey } from '@/lib/api-key';
import { logger } from '@/utils/logger';

import type { AiService } from './types';

export interface CappedVendor {
  /** The id the chain uses for this vendor (config/free-vendors). */
  vendor: string;
  /** The env var holding the platform's key. */
  keyEnv: string;
  /** The env var that sets the day's cap, in calls. */
  capEnv: string;
  /** The cap when the env var is not set: low on purpose. */
  defaultCap: number;
}

/** Every vendor the platform pays for. A vendor not here is free or not ours. */
export const CAPPED_VENDORS: readonly CappedVendor[] = [
  { vendor: 'google', keyEnv: 'GEMINI_API_KEY', capEnv: 'GEMINI_DAILY_CALL_CAP', defaultCap: 300 },
  // Free tiers today, but a free key bills the day its account is upgraded,
  // and OpenRouter's key also serves paid models against Cat Credits. A cap
  // on each, so no upgrade or credit balance can turn into unbounded spend.
  { vendor: 'groq', keyEnv: 'GROQ_API_KEY', capEnv: 'GROQ_DAILY_CALL_CAP', defaultCap: 3000 },
  {
    vendor: 'openrouter',
    keyEnv: 'OPENROUTER_API_KEY',
    capEnv: 'OPENROUTER_DAILY_CALL_CAP',
    defaultCap: 1000,
  },
  {
    vendor: 'together',
    keyEnv: 'TOGETHER_API_KEY',
    capEnv: 'TOGETHER_DAILY_CALL_CAP',
    defaultCap: 300,
  },
  // Embeddings (memory recall, search) on a paid host. A self-hosted
  // embeddings server is not counted (embeddings.ts).
  {
    vendor: 'embeddings',
    keyEnv: 'EMBEDDINGS_API_KEY',
    capEnv: 'EMBEDDINGS_DAILY_CALL_CAP',
    defaultCap: 5000,
  },
  {
    vendor: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    capEnv: 'OPENAI_DAILY_CALL_CAP',
    defaultCap: 5000,
  },
];

/**
 * Metered services called through a package that picks the backend itself,
 * so the call cannot be matched to a key: counted by name. Web search tries
 * the self-hosted SearXNG first and the paid Brave or Tavily after it; every
 * search is counted, the free ones too, which errs on the strict side.
 */
export const CAPPED_SERVICES = {
  webSearch: { vendor: 'web-search', capEnv: 'WEB_SEARCH_DAILY_CALL_CAP', defaultCap: 1000 },
} as const;

/** Pure: the day's cap from the environment, or the default. 0 turns it off. */
export function capFor(v: CappedVendor, env: Record<string, string | undefined>): number {
  const raw = env[v.capEnv]?.trim();
  if (raw === undefined || raw === '') {
    return v.defaultCap;
  }
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : v.defaultCap;
}

/** Pure: the capped vendor this key is the platform's key for, or null. */
export function platformVendorForKey(
  key: string | null | undefined,
  env: Record<string, string | undefined>
): CappedVendor | null {
  const clean = key ? sanitizeApiKey(key) : '';
  if (!clean) {
    return null;
  }
  return (
    CAPPED_VENDORS.find(v => {
      const own = env[v.keyEnv];
      return !!own && sanitizeApiKey(own) === clean;
    }) ?? null
  );
}

/** Thrown when the day's cap is reached. A 429, so the chain moves on to the
 *  next link and counts it as rationed, not broken. */
export class VendorCapReached extends Error {
  readonly status = 429;
  readonly statusCode = 429;
  readonly type = 'rate_limit';
  constructor(readonly vendor: string) {
    super(`daily spending cap reached for ${vendor} (rate limit)`);
    this.name = 'VendorCapReached';
  }
}

type Reserve = (vendor: string, cap: number) => Promise<boolean>;

const reserveInDatabase: Reserve = async (vendor, cap) => {
  try {
    const { data, error } = await (
      getAdminClient() as unknown as {
        rpc: (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: unknown }>;
      }
    ).rpc('reserve_vendor_call', { p_vendor: vendor, p_cap: cap });
    if (error) {
      logger.warn('vendor cap: count unavailable, call refused', { vendor }, 'VendorSpendCap');
      return false;
    }
    return data === true;
  } catch {
    logger.warn('vendor cap: count unavailable, call refused', { vendor }, 'VendorSpendCap');
    return false;
  }
};

/**
 * Take one call from the day's allowance of the platform key this is, or
 * throw VendorCapReached. A key that is not a capped platform key passes.
 */
export async function reservePlatformCall(
  key: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
  reserve: Reserve = reserveInDatabase
): Promise<void> {
  const v = platformVendorForKey(key, env);
  if (!v) {
    return;
  }
  if (!(await reserve(v.vendor, capFor(v, env)))) {
    throw new VendorCapReached(v.vendor);
  }
}

/** Take one call from a named service's daily allowance (CAPPED_SERVICES),
 *  or throw VendorCapReached. */
export async function reserveServiceCall(
  service: (typeof CAPPED_SERVICES)[keyof typeof CAPPED_SERVICES],
  env: Record<string, string | undefined> = process.env,
  reserve: Reserve = reserveInDatabase
): Promise<void> {
  const cap = capFor({ ...service, keyEnv: '' }, env);
  if (!(await reserve(service.vendor, cap))) {
    throw new VendorCapReached(service.vendor);
  }
}

/** The service with every call counted against the vendor's daily cap. */
export function cappedService(
  service: AiService,
  key: string,
  env: Record<string, string | undefined> = process.env,
  reserve: Reserve = reserveInDatabase
): AiService {
  if (!platformVendorForKey(key, env)) {
    return service;
  }
  return {
    ...service,
    chatCompletion: async opts => {
      await reservePlatformCall(key, env, reserve);
      return service.chatCompletion(opts);
    },
    streamChatCompletion: opts =>
      (async function* () {
        await reservePlatformCall(key, env, reserve);
        yield* service.streamChatCompletion(opts);
      })(),
  };
}
