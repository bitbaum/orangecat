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
  freeChain,
  type CatalogVerdict,
  type Provider,
} from '@bitbaum/ai-kit';
import { PROVIDER_BASE_URLS } from '@/config/ai-provider-runtime';
import { getFreeModels } from '@/config/ai-models';
import { CONFIGURED_GROQ_MODEL_IDS } from '@/services/ai/groq-models';
import { FREE_VENDORS, vendorModel } from '@/config/free-vendors';
import { PLATFORM_GROQ_FALLBACK_MODEL, PLATFORM_GROQ_MODEL } from '@/services/ai/groq-models';
import { getModelMetadata, DEFAULT_FREE_MODEL_ID } from '@/config/ai-models';
import { resolveFreePool } from '@/services/ai/free-model-pool';
import { createAutoRouter } from '@/services/ai/auto-router';
import { analyzeComplexity } from '@/services/ai/message-complexity';

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

/** Together's pinned free model. Watched like every other id, not trusted. */
const TOGETHER_DEFAULT_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free';
const TOGETHER_DAILY_TOKENS = 50_000;

/**
 * Every OpenRouter free model, ordered by the auto-router's preference for THIS
 * message — best fit first, the rest as fallbacks.
 *
 * Lives here rather than in the provider builder because "which models, in what
 * order" is the CHAIN's business; the builder's job is turning a link into a
 * callable service. Keeping the two apart is what stopped them describing
 * different chains, which is exactly what had happened.
 */
function orderedOpenRouterFreeModels(message: string): string[] {
  const freeIds = getFreeModels()
    .map(m => m.id)
    .filter(id => !!getModelMetadata(id));
  if (freeIds.length === 0) {
    return resolveFreePool([DEFAULT_FREE_MODEL_ID]);
  }

  const auto = createAutoRouter();
  const top = auto.selectModel({
    message,
    conversationHistory: [],
    allowedModels: freeIds,
  }).model;

  const head = getModelMetadata(top) ? top : freeIds[0]!;
  const rest = freeIds.filter(id => id !== head);

  // Last step, and the only one that reads the vendor rather than the repo:
  // drop ids OpenRouter has retired, and append live free ones the registry
  // never knew about. See services/ai/free-model-pool.ts.
  return resolveFreePool([head, ...rest]);
}

/**
 * Complexity at or above which a turn leads with a stronger free vendor.
 *
 * 0.5 rather than the router's own 0.3 'standard' line, on purpose: this
 * spends a scarcer bucket, so it should fire on the genuinely hard turn and
 * not on every message with the word "idea" in it. `CAT_COMPLEXITY_ESCALATION=0`
 * turns it off without a deploy.
 */
const COMPLEXITY_ESCALATION_AT = 0.5;

/** Is this turn hard enough to be worth a better free model? */
export function shouldEscalateForComplexity(message?: string): boolean {
  if (!message || process.env.CAT_COMPLEXITY_ESCALATION === '0') {
    return false;
  }
  return analyzeComplexity(message, []).score >= COMPLEXITY_ESCALATION_AT;
}

/**
 * Which of a vendor's models can read an image — ai-kit's declaration, adopted
 * rather than re-listed (ai-kit owns the chain; apps adapt). Absent for a
 * vendor ai-kit does not classify, which ai-kit reads as "unknown", not "no".
 */
function declaredVisionModels(providerId: string): string[] | undefined {
  return freeChain().find(p => p.id === providerId)?.visionModels;
}

/**
 * THE CHAIN OrangeCat ACTUALLY CALLS, in order. One definition, one order.
 *
 * This used to be two. `orangecatChain()` described a chain for the rot check
 * while `buildPlatformProviders()` built a different one for real requests, and
 * they drifted in all three ways a duplicated list can:
 *
 *   - ORDER. The rot list read groq -> openrouter -> vendors; the serving chain
 *     read groq -> vendors -> openrouter (#1036). Nothing reconciled them.
 *   - MEMBERSHIP. Together was in the serving chain and in NO rot check, so its
 *     pinned `meta-llama/Llama-3.3-70B-Instruct-Turbo-Free` — the llama-3.3
 *     family retired across other vendors — was never once checked.
 *   - MODELS. Each re-derived its own ids from config, separately.
 *
 * Ordering is CAPACITY, not preference, and the scarcest pool goes last:
 * OpenRouter's unpaid tier is 50 requests a DAY for an account ten apps share,
 * while Groq rations per model and Gemini's quota is per project.
 *
 * `message` orders the OpenRouter models for this turn. Omit it and they keep
 * registry order, which is all a rot check needs.
 */
export function servingChain(message?: string): Provider[] {
  const openRouterModels = message
    ? orderedOpenRouterFreeModels(message)
    : getFreeModels().map(m => m.id);

  const groq = {
    id: 'groq',
    baseUrl: PROVIDER_BASE_URLS.groq,
    keyEnv: 'GROQ_API_KEY',
    // The two the PLATFORM serves, in order, deduped — not every configured
    // id. A metered id here can only 402 for a user with no credits, which is
    // the bug #1000 fixed. BYOK-selectable ids are watched by
    // `orangecatChain()` below instead of being dialled here.
    models: [...new Set([PLATFORM_GROQ_MODEL, PLATFORM_GROQ_FALLBACK_MODEL])],
    visionModels: declaredVisionModels('groq'),
    dailyTokens: GROQ_DAILY_TOKENS,
  };
  // Free vendors before OpenRouter: their quotas are per project/account of
  // our own, OpenRouter's is shared and nearly always spent.
  const freeVendors = FREE_VENDORS.map(v => ({
    id: v.id,
    baseUrl: v.baseUrl,
    keyEnv: v.keyEnv,
    models: [vendorModel(v)],
    visionModels: declaredVisionModels(v.id),
    dailyTokens: FREE_VENDOR_DAILY_TOKENS,
  }));

  // ── Escalation, and why it is ordered THIS way ────────────────────────────
  // The platform's Groq link is deliberately the FAST model (gpt-oss-20b), not
  // the capable one: gpt-oss-120b is tiered `economy`, so serving it here
  // would 402 every user with no credits (#1000). That trade is right for the
  // ordinary turn and wrong for the rare hard one, which until now got the 20B
  // like everything else and then a banner suggesting the user upgrade.
  //
  // So on a genuinely complex turn the chain leads with a free VENDOR instead.
  // Deliberately not OpenRouter, capable though its pool is: that key is
  // shared across every app on this box and is nearly always spent, and the
  // rule earned the hard way is to drain the scarcest bucket LAST. The free
  // vendors hold our own per-project quota, so this spends the right budget.
  // Groq stays immediately behind, so a drained or broken vendor costs one
  // round-trip rather than the answer.
  const leaders = shouldEscalateForComplexity(message)
    ? [...freeVendors, groq]
    : [groq, ...freeVendors];

  return [
    ...leaders,
    {
      id: 'openrouter',
      baseUrl: PROVIDER_BASE_URLS.openrouter,
      keyEnv: 'OPENROUTER_API_KEY',
      models: openRouterModels,
      visionModels: declaredVisionModels('openrouter'),
      dailyTokens: OPENROUTER_DAILY_TOKENS,
    },
    {
      id: 'together',
      baseUrl: PROVIDER_BASE_URLS.together,
      keyEnv: 'TOGETHER_API_KEY',
      models: [process.env.TOGETHER_DEFAULT_MODEL?.trim() || TOGETHER_DEFAULT_MODEL],
      dailyTokens: TOGETHER_DAILY_TOKENS,
    },
  ];
}

/**
 * What the rot check watches: the serving chain, widened where a BYOK user can
 * select an id the platform itself never dials.
 *
 * A SUPERSET by construction rather than a second list, so the two cannot
 * disagree about the part that matters — what we actually call. Groq is the
 * only vendor with the distinction: `CONFIGURED_GROQ_MODEL_IDS` is what a
 * BYOK user may pick, and a retirement there breaks them just as completely.
 *
 * Ollama is deliberately absent: it is a local process with no catalogue to
 * read, so there is nothing for a rot check to ask it.
 */
export function orangecatChain(): Provider[] {
  return servingChain().map(p =>
    p.id === 'groq'
      ? { ...p, models: [...new Set([...p.models, ...CONFIGURED_GROQ_MODEL_IDS])] }
      : p
  );
}

/**
 * Split a model id into the family it belongs to and its version.
 *
 * `anthropic/claude-fable-5-1` → stem `anthropic/claude-fable`, version [5, 1]
 * `anthropic/claude-opus-4.8`  → stem `anthropic/claude-opus`,  version [4, 8]
 * `openai/gpt-oss-20b`         → no version (the trailing segment is not
 *                                digits), so the id is never compared
 *
 * Requiring the version to be PURELY numeric is what keeps this quiet. A
 * looser parse makes `gpt-oss-120b` a successor to `gpt-oss-20b`, which is a
 * different model at a different size, and a check that cries wolf is a check
 * that gets muted.
 */
function splitVersion(rawId: string): { stem: string; version: number[] } | null {
  const id = rawId.replace(/:free$/, '');
  const parts = id.split(/[-.]/);
  const version: number[] = [];
  let i = parts.length;
  while (i > 0 && /^\d+$/.test(parts[i - 1])) {
    version.unshift(Number(parts[i - 1]));
    i--;
  }
  if (version.length === 0 || i === 0) {
    return null;
  }
  return { stem: parts.slice(0, i).join('-'), version };
}

/** Numeric version compare: [5,1] > [5] > [4,8]. */
function isNewer(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) {
      return x > y;
    }
  }
  return false;
}

export type SupersededPin = {
  provider: string;
  /** The id we pin. It still works — this is not rot. */
  pinned: string;
  /** A newer version of the same family the vendor now lists. */
  successor: string;
};

/**
 * Pins the vendor has since published a NEWER VERSION of.
 *
 * This is the half the rot check could not see. `missing` answers "did a
 * pinned id die"; a model that is merely superseded is still listed, still
 * served, and still answers — so nothing ever fired, and the catalogue sat a
 * version behind indefinitely. That is exactly how `claude-fable-5` stayed
 * pinned after `claude-fable-5-1` shipped: not a dead pointer, just an old
 * one, and the check was structurally blind to the difference.
 *
 * Reads `verdict.live`, which checkCatalog already fetched, so this costs no
 * extra request. It is a NUDGE, never a failure: being a version behind is a
 * decision someone should make deliberately, not an outage.
 */
export function findSupersededPins(verdicts: CatalogVerdict[]): SupersededPin[] {
  const found: SupersededPin[] = [];

  for (const verdict of verdicts) {
    if (!verdict.live) {
      continue; // Could not read the catalogue — unknown, not "up to date".
    }
    const liveParsed = verdict.live
      .map(id => ({ id, parsed: splitVersion(id) }))
      .filter((x): x is { id: string; parsed: { stem: string; version: number[] } } => !!x.parsed);

    for (const pinned of verdict.present) {
      const mine = splitVersion(pinned);
      if (!mine) {
        continue;
      }
      const newer = liveParsed
        .filter(x => x.parsed.stem === mine.stem && isNewer(x.parsed.version, mine.version))
        .sort((a, b) => (isNewer(a.parsed.version, b.parsed.version) ? -1 : 1))[0];

      if (newer) {
        found.push({ provider: verdict.provider, pinned, successor: newer.id });
      }
    }
  }

  return found;
}

export type ModelRotReport = {
  verdicts: CatalogVerdict[];
  /** Pinned ids the vendor no longer lists, across every provider. */
  retired: string[];
  /** Providers whose catalogue could not be read — unknown, NOT healthy. */
  unreadable: string[];
  /** True only when a pinned id is CONFIRMED gone. */
  rotted: boolean;
  /**
   * Pins with a newer version available. NOT counted in `rotted` — these
   * still serve. Surfaced so being a version behind is a choice rather than
   * an oversight.
   */
  superseded: SupersededPin[];
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
    superseded: findSupersededPins(verdicts),
  };
}
