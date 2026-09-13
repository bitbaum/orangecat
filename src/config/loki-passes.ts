/**
 * Loki passes — OrangeCat-side SSOT for the Bitcoin entitlement rail.
 *
 * Loki (the execution layer) sells its paid plans as Bitcoin-payable
 * OrangeCat products. A "pass" is an ordinary `user_products` row carrying two
 * marker tags the settlement notifier reads:
 *
 *     loki-plan:<personal|pro|team>   loki-days:<n>
 *
 * On a settled payment for such a product, notifyLokiEntitlement()
 * (src/services/loki/entitlement-notify.ts) POSTs a signed grant to
 * Loki, which flips users.plan for `periodDays` — Bitcoin has no native
 * recurring, so a pass is a renewable time-box.
 *
 * This file is the ONE place that knows the plan set, the tag format, the
 * parser, and the canonical pass catalogue:
 *   - the seed (scripts/seed-loki-passes.ts) WRITES tags via passTags()
 *   - the notifier READS them via parseLokiPass()
 * Same source → they cannot drift (guarded by __tests__/unit/loki).
 *
 * Prices mirror Loki's /pricing. Both are currently "to be announced"
 * (price: null; the seed pauses the pass products so nothing can be bought at
 * a stale price) — announce by setting numbers here AND in Loki's
 * src/config/plans.ts, then re-run the seed. OrangeCat converts CHF → BTC at
 * checkout.
 */

/** The paid Loki tiers sold as OrangeCat passes (excludes the free tier). */
export const LOKI_PLANS = ['personal', 'pro', 'team'] as const;
export type LokiPlan = (typeof LOKI_PLANS)[number];

/** Default pass length. BTC has no native recurring — a pass is a time-box. */
export const LOKI_PASS_PERIOD_DAYS = 30;

const PLAN_SET = new Set<string>(LOKI_PLANS);

/**
 * The two marker tags a Loki-pass product must carry. This is the SSOT
 * for the tag format; parseLokiPass() below is its exact inverse.
 */
export function passTags(plan: LokiPlan, periodDays: number): [string, string] {
  return [`loki-plan:${plan}`, `loki-days:${periodDays}`];
}

/** Extract {plan, periodDays} from a product's tags, or null if not a pass. */
export function parseLokiPass(
  tags: unknown
): { plan: LokiPlan; periodDays: number } | null {
  if (!Array.isArray(tags)) {
    return null;
  }
  let plan: LokiPlan | null = null;
  let periodDays: number | null = null;
  for (const raw of tags) {
    if (typeof raw !== 'string') {
      continue;
    }
    const t = raw.trim();
    const p = /^loki-plan:([a-z]+)$/.exec(t);
    if (p && PLAN_SET.has(p[1])) {
      plan = p[1] as LokiPlan;
    }
    const d = /^loki-days:(\d{1,4})$/.exec(t);
    if (d) {
      periodDays = parseInt(d[1], 10);
    }
  }
  return plan && periodDays ? { plan, periodDays } : null;
}

export interface LokiPass {
  plan: LokiPlan;
  title: string;
  description: string;
  /**
   * Price in `currency`; OrangeCat converts to BTC at checkout.
   * null = to be announced — the seed pauses the pass so it cannot be bought.
   */
  price: number | null;
  currency: 'CHF';
  periodDays: number;
  /** The marker tags stored on the product (built from passTags()). */
  tags: string[];
}

/**
 * Actor that sells the passes. There is no dedicated "Loki" platform
 * actor — the founder's `mao` actor already owns the OrangeCat and Loki
 * projects, so it sells the passes too and its wallet receives the BTC. Swap to
 * a dedicated actor/group later by changing this slug and re-running the seed.
 */
export const OWNER_ACTOR_SLUG = 'mao';

interface PassSpec {
  plan: LokiPlan;
  title: string;
  description: string;
  price: number | null;
}

const PASS_SPECS: PassSpec[] = [
  {
    plan: 'personal',
    title: 'Loki Pass — Personal',
    description:
      'One month of Loki Personal, paid in Bitcoin. Room for a real ' +
      'project portfolio, the full captain dashboard, and your own runner and ' +
      'agent keys. Renewable — pay again to extend.',
    price: null,
  },
  {
    plan: 'pro',
    title: 'Loki Pass — Pro',
    description:
      'One month of Loki Pro, paid in Bitcoin. For operators running many ' +
      'projects at once — no ceiling as your fleet grows. Renewable.',
    price: null,
  },
  {
    plan: 'team',
    title: 'Loki Pass — Team',
    description:
      'One month of Loki Team, paid in Bitcoin. Shared projects and fleet ' +
      'visibility for a studio. Renewable.',
    price: null,
  },
];

/** The canonical pass catalogue the seed inserts and the notifier honours. */
export const LOKI_PASSES: LokiPass[] = PASS_SPECS.map(s => ({
  plan: s.plan,
  title: s.title,
  description: s.description,
  price: s.price,
  currency: 'CHF',
  periodDays: LOKI_PASS_PERIOD_DAYS,
  tags: passTags(s.plan, LOKI_PASS_PERIOD_DAYS),
}));
