/**
 * Has a vendor retired a model OrangeCat still pins?
 *
 * The check itself is `@bitbaum/ai-kit/catalog`, which exists because the fleet
 * has been bitten by this repeatedly: on 2026-08-25 four of nine pinned ids in
 * the shared chain were gone — both Groq models, so the whole first vendor —
 * and a consumer that also used the Groq id for direct calls had been silently
 * failing for eight days. The package's own header says why it lives there:
 * "the check is the same everywhere, and the app that wrote its own first wrote
 * it slightly differently."
 *
 * OrangeCat wrote its own first, twice. `probeFreeModelCatalog` watched
 * OpenRouter, `probeGroqModelCatalog` watched Groq, each with its own copy of
 * the three-state null handling — and any provider added later would have
 * needed a third. This describes the chain instead, and hands it over.
 *
 * The models here are READ from the config OrangeCat actually serves from, not
 * relisted. A third hand-maintained list of model ids is precisely the thing
 * this file is checking for.
 */
// Root barrel: 1.4.1 publishes these on '.', not as /catalog or /chain subpaths.
import {
  checkCatalog,
  hasRot,
  deadProviders,
  type CatalogVerdict,
  type Provider,
} from '@bitbaum/ai-kit';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { getFreeModels } from '@/config/ai-models';
import { CONFIGURED_GROQ_MODEL_IDS } from '@/services/ai/groq-models';
import { FREE_VENDORS, vendorModel } from '@/config/free-vendors';

/**
 * `dailyTokens` is only used by ai-kit's fair-share rationing, which OrangeCat
 * does not use yet. Stated low rather than invented high: handing out shares of
 * capacity that turns out not to exist produces the exact wall rationing is
 * meant to prevent, only later and harder to diagnose.
 */
const GROQ_DAILY_TOKENS = 100_000;
const OPENROUTER_DAILY_TOKENS = 50_000;
/** Stated low on purpose: an invented allowance produces the wall it was meant to prevent. */
const FREE_VENDOR_DAILY_TOKENS = 50_000;

/** OrangeCat's platform chain, in the vocabulary the shared checker speaks. */
export function orangecatChain(): Provider[] {
  return [
    {
      id: 'groq',
      baseUrl: PROVIDER_BASE_URLS.groq,
      keyEnv: 'GROQ_API_KEY',
      models: [...CONFIGURED_GROQ_MODEL_IDS],
      dailyTokens: GROQ_DAILY_TOKENS,
    },
    {
      id: 'openrouter',
      baseUrl: PROVIDER_BASE_URLS.openrouter,
      keyEnv: 'OPENROUTER_API_KEY',
      models: getFreeModels().map(m => m.id),
      dailyTokens: OPENROUTER_DAILY_TOKENS,
    },
    // Every free vendor, watched from the first run with a key. Their model ids
    // are best-known rather than verified, which is exactly why they belong in
    // a rot check instead of being trusted.
    ...FREE_VENDORS.map(v => ({
      id: v.id,
      baseUrl: v.baseUrl,
      keyEnv: v.keyEnv,
      models: [vendorModel(v)],
      dailyTokens: FREE_VENDOR_DAILY_TOKENS,
    })),
  ];
}

export type ModelRotReport = {
  verdicts: CatalogVerdict[];
  /** Pinned ids the vendor no longer lists, across every provider. */
  retired: string[];
  /** Providers whose catalogue could not be read — unknown, NOT healthy. */
  unreadable: string[];
  /** True only when a pinned id is CONFIRMED gone. */
  rotted: boolean;
};

/**
 * Ask every provider in the chain whether it still lists what we pin.
 *
 * Costs no tokens — one GET /models per provider — which is what makes it
 * something a timer can run rather than something someone has to remember.
 */
export async function checkModelRot(): Promise<ModelRotReport> {
  const verdicts = await checkCatalog(orangecatChain());
  return {
    verdicts,
    retired: verdicts.flatMap(v => v.missing),
    // An unreadable catalogue is not evidence of rot, and not evidence of
    // health either. Naming it keeps the third state visible to the caller.
    unreadable: deadProviders(verdicts),
    rotted: hasRot(verdicts),
  };
}
