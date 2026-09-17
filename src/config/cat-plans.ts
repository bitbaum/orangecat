/**
 * Cat plans — the ONE source of truth for everything pricing.
 *
 * Every fact about plans lives here: limits, prices, statuses, copy, CTAs,
 * upsell strings, and the tier↔plan mapping. The layers around it each have
 * exactly one job and never restate a fact:
 *
 *   config  (this file)         → WHAT the plans are. Numbers, copy, gates.
 *   SQL     (check_platform_limit / increment_platform_usage /
 *            user_plans.daily_limit in the baseline migration)
 *                               → ENFORCES the free limit at the counter.
 *                                 SQL can't import TS, so its literals are
 *                                 machine-guarded by the drift test:
 *                                 __tests__/unit/cat/plan-limit-drift.test.ts
 *                                 — change a limit on either side alone and
 *                                 CI fails, pointing here.
 *   services (provider-resolver, api-key-service, supporter/grant,
 *            credit-metering)   → APPLY the rules (BYOK bypass, metering,
 *                                 grants). grant.ts imports
 *                                 CAT_SUPPORTER_DAILY_LIMIT — never a literal.
 *   UI      (/pricing, /settings/usage, QuotaMeter, CatSettingsTab)
 *                               → RENDER only. No plan fact may be typed into
 *                                 a component; import it from here.
 *
 * Plans, honest about what's shipped ("sell intelligence, not rails" — P2P
 * payments stay 0% forever; the platform earns on Cat Credits):
 *   - free      → what every user gets today (CAT_FREE_DAILY_LIMIT msgs/day)
 *   - supporter → flat CHF/mo pass, raises the cap (DB tier 'pro')
 *   - byok      → your key, your bill, no cap, zero markup
 *   - credits   → pay-as-you-go frontier AI against a prepaid BTC balance
 */

import { ROUTES } from '@/config/routes';
import { FEATURES } from '@/config/features';
import { CREDIT_USAGE_MARKUP } from '@/services/cat/credit-metering';
import { WIRED_PROVIDER_DISPLAY_NAMES } from '@/data/aiProviders';

export type CatPlanId = 'free' | 'supporter' | 'byok' | 'credits';

/**
 * True once the platform Lightning wallet (PLATFORM_NWC_URI) is provisioned and
 * one live top-up has been verified — the credits card then switches from
 * "activating" to a live top-up CTA.
 *
 * Env-derived (NEXT_PUBLIC_CAT_CREDITS_LIVE) rather than a hardcoded constant so
 * going live is an env change on the box, not a code deploy. SSOT: the fact
 * "credits are live" has one source. The server top-up route independently
 * gates on PLATFORM_NWC_URI, so flipping this without the wallet is safe.
 */
export const CAT_CREDITS_LIVE = FEATURES.catCreditsLive;

/** Platform margin label — derived from CREDIT_USAGE_MARKUP so marketing never drifts. */
export const CAT_CREDITS_MARKUP_LABEL = `provider cost + ${Math.round((CREDIT_USAGE_MARKUP - 1) * 100)}%`;

export interface CatPlan {
  id: CatPlanId;
  name: string;
  tagline: string;
  /** Short price line shown under the name. Honest copy only. */
  priceCopy: string;
  bullets: string[];
  cta: {
    label: string;
    href: string;
    variant: 'accent' | 'outline';
  };
  status: 'available' | 'coming-soon';
  /** Optional badge text shown on the tier card. */
  badge?: string;
}

/**
 * Daily message cap for non-BYOK users on the free tier. Mirrors the
 * default in src/services/ai/api-key-service.ts:checkPlatformUsage so the
 * page never advertises a different number than the runtime enforces.
 */
// ---------------------------------------------------------------------------
// Cat Credits top-up bounds + UI presets — one place, so a preset can never
// drift outside what the API accepts.
// ---------------------------------------------------------------------------
export const MIN_TOPUP_BTC = 0.00001;
export const MAX_TOPUP_BTC = 0.01;
export const TOPUP_PRESETS_BTC = ([0.0001, 0.0005, 0.001] as const).filter(
  v => v >= MIN_TOPUP_BTC && v <= MAX_TOPUP_BTC
);

export const CAT_FREE_DAILY_LIMIT = 10;

/**
 * Supporter plan — OrangeCat's own flat, Bitcoin-native subscription, built on
 * the same pass-product pattern Loki uses (a tagged product → on
 * settlement, grant a time-boxed plan). A Supporter pays a flat monthly in
 * Bitcoin and gets a raised daily Cat cap (tier 'pro' in user_plans); the money
 * funds the platform AI budget. Period comes from the product's
 * `supporter-days:<n>` tag; this cap and price are the config SSOT.
 */
export const CAT_SUPPORTER_DAILY_LIMIT = 200;
/**
 * null = price to be announced: the plan card stays, no number is shown, and
 * the Supporter product entity is PAUSED so nothing can be bought at a stale
 * price (the schema forbids price 0). Announce a price by setting the number
 * here AND updating + re-activating the product — this is the display side,
 * the product is the charge side.
 */
export const SUPPORTER_PRICE_CHF: number | null = null;

/**
 * Supporter checkout URL — the OrangeCat product page for the Supporter pass.
 * Mirrors Loki's ORANGECAT_PAY_URL_* gate: set
 * NEXT_PUBLIC_SUPPORTER_PRODUCT_URL once the product exists AND the platform
 * wallet (PLATFORM_NWC_URI) can receive, and the card flips from "activating"
 * to a live checkout. Unset (today) → the honest founding-supporter fallback.
 */
export const SUPPORTER_CHECKOUT_URL = process.env.NEXT_PUBLIC_SUPPORTER_PRODUCT_URL ?? '';
export const SUPPORTER_LIVE = SUPPORTER_CHECKOUT_URL.length > 0;

/**
 * Providers Cat actually routes through today, surfaced on /pricing so the
 * BYOK card shows real names instead of a vague "any provider" promise.
 * Derived from WIRED_PROVIDER_IDS in src/data/aiProviders.ts.
 */
export const CAT_WIRED_PROVIDERS = WIRED_PROVIDER_DISPLAY_NAMES;

/**
 * SSOT for the frontier models named in marketing copy (pricing, support,
 * settings). Brand-level on purpose — never a specific version like "GPT-4o",
 * which reads as stale the moment a new model ships. Change here once and every
 * page updates; do NOT hardcode this list in page copy.
 */
export const CAT_FRONTIER_MODELS = ['Claude', 'GPT', 'Grok'] as const;
/** "Claude, GPT, Grok" */
export const CAT_FRONTIER_MODELS_LIST = CAT_FRONTIER_MODELS.join(', ');
/** "Claude, GPT, or Grok" */
export const CAT_FRONTIER_MODELS_OR = `${CAT_FRONTIER_MODELS.slice(0, -1).join(', ')}, or ${CAT_FRONTIER_MODELS[CAT_FRONTIER_MODELS.length - 1]}`;

/**
 * Deep links into /settings/ai — the EXACT section where each plan is acted
 * on. Config-level so every surface (pricing cards, /settings/usage, chat
 * upsells) lands the user on the form, not a page top they must scan.
 * The ids are stamped on the sections in settings/ai/page.tsx; the drift
 * pair is guarded by __tests__/unit/cat/plan-limit-drift.test.ts.
 */
export const SETTINGS_AI_ANCHORS = {
  credits: `${ROUTES.SETTINGS_AI}#credits`,
  byok: `${ROUTES.SETTINGS_AI}#byok`,
  local: `${ROUTES.SETTINGS_AI}#local`,
} as const;

export const CAT_PLANS: CatPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For everyone, forever',
    priceCopy: 'CHF 0 / mo',
    bullets: [
      `${CAT_FREE_DAILY_LIMIT} Cat messages every day`,
      'Best free open-source model, picked automatically (Llama, Gemini, DeepSeek)',
      'Cat reads your entities — knows your projects, products, wallet',
      'Visible tool calls, cited results, chats clearable any time',
    ],
    cta: { label: 'Start chatting', href: ROUTES.DASHBOARD.CAT, variant: 'outline' },
    status: 'available',
  },
  {
    id: 'supporter',
    name: 'Supporter',
    tagline: 'Back OrangeCat — and get more Cat',
    priceCopy:
      SUPPORTER_PRICE_CHF === null
        ? 'Price to be announced · in Bitcoin'
        : SUPPORTER_LIVE
          ? `CHF ${SUPPORTER_PRICE_CHF} / mo · in Bitcoin`
          : `CHF ${SUPPORTER_PRICE_CHF} / mo · activating`,
    bullets: [
      `${CAT_SUPPORTER_DAILY_LIMIT} Cat messages every day — ${Math.round(CAT_SUPPORTER_DAILY_LIMIT / CAT_FREE_DAILY_LIMIT)}× the free tier`,
      'No keys, no metering — a flat monthly, settled in Bitcoin',
      'Directly funds the platform AI budget (P2P stays 0% fees, always)',
      `First access to managed frontier models (${CAT_FRONTIER_MODELS_LIST}) the day Pro ships`,
    ],
    cta: SUPPORTER_LIVE
      ? { label: 'Become a Supporter', href: SUPPORTER_CHECKOUT_URL, variant: 'accent' }
      : { label: 'Become a supporter', href: ROUTES.SUPPORT, variant: 'outline' },
    status: SUPPORTER_LIVE ? 'available' : 'coming-soon',
    badge: SUPPORTER_LIVE ? 'Live' : 'Activating',
  },
  {
    id: 'byok',
    name: 'Bring your own key',
    tagline: 'Any provider. Your bill. No markup.',
    priceCopy: 'CHF 0 / mo to OrangeCat',
    bullets: [
      `Six providers wired direct: ${CAT_WIRED_PROVIDERS.join(', ')}`,
      'Want Claude / GPT / Gemini? OpenRouter fronts 200+ models with one key',
      'Cat routes through your key — OrangeCat never sees your bill, never marks it up',
      'Keys encrypted at rest, scrubbed from logs, never echoed back to the client',
    ],
    cta: { label: 'Add your key', href: SETTINGS_AI_ANCHORS.byok, variant: 'accent' },
    status: 'available',
    badge: 'Available now',
  },
  {
    id: 'credits',
    name: 'Cat Credits',
    tagline: 'Pay as you go — managed frontier AI, billed in Bitcoin',
    priceCopy: `Top up over Lightning · ${CAT_CREDITS_MARKUP_LABEL}`,
    bullets: [
      `Frontier models (${CAT_FRONTIER_MODELS_LIST}) managed by OrangeCat — no keys, no setup`,
      'No subscription: you pay only for what the Cat actually computes',
      'Prepaid balance, transparent per-message ledger, top up from 0.00001 BTC',
      'Full agentic Cat: discovery, matchmaking, multi-step tasks',
    ],
    cta: CAT_CREDITS_LIVE
      ? { label: 'Top up credits', href: SETTINGS_AI_ANCHORS.credits, variant: 'accent' }
      : { label: 'Become a supporter', href: ROUTES.SUPPORT, variant: 'outline' },
    status: CAT_CREDITS_LIVE ? 'available' : 'coming-soon',
    badge: CAT_CREDITS_LIVE ? 'Live' : 'Activating',
  },
];

/** Plan lookup by id — CAT_PLANS is short, a scan is fine. */
export function getCatPlan(id: CatPlanId): CatPlan {
  const plan = CAT_PLANS.find(p => p.id === id);
  if (!plan) {
    throw new Error(`Unknown Cat plan id: ${id}`);
  }
  return plan;
}

/**
 * The naming seam, stated ONCE: the quota API / user_plans table speak in
 * tiers ('free' | 'pro' | 'byok'), the product speaks in plans — and the
 * paid tier is called 'pro' in the DB but sold as 'Supporter'. Every UI
 * that needs "which plan card is this user on" goes through this map
 * instead of re-deriving the ternary.
 */
export const PLAN_ID_BY_QUOTA_TIER = {
  free: 'free',
  pro: 'supporter',
  byok: 'byok',
} as const satisfies Record<'free' | 'pro' | 'byok', CatPlanId>;

/**
 * Canonical upsell copy — the "you can have more Cat" strings, written once.
 * UI surfaces (QuotaMeter, CatSettingsTab, /settings/usage, error states)
 * import these instead of each hand-writing a slightly different promise.
 */
export const CAT_UPSELL = {
  /** Compact suffix for meters/tooltips. */
  byokShort: 'Add your own API key for unlimited',
  /** Full sentence for settings/explanatory surfaces. */
  byokFull:
    'Add your own API key for unlimited messages — you pay your provider directly, OrangeCat never marks it up.',
  /** Link label for the BYOK CTA. */
  byokAction: 'Add your key',
  /**
   * Capped-state label. Two widths because the meter sits in a crowded
   * toolbar: the long form only renders where there's room (≥sm), and the
   * short form keeps the chip from overflowing into the panel controls on
   * phones. Copy lives HERE, not inline in the component.
   */
  cappedLabel: 'Daily limit reached',
  cappedLabelShort: 'Limit reached',
} as const;
