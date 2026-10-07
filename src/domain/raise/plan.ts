/**
 * A raise plan — what someone needs, what it costs, and how they will ask.
 *
 * Pure: no HTTP, no LLM, no React. The planner turns a model's answer into a
 * plan through `normalizePlan` (which never trusts a number it was handed),
 * the page edits the plan, and `planToEntityRequest` turns the final plan into
 * the create payload for the entity its rail maps to. The cost breakdown is
 * written into the page's story, so a backer sees what each franc is for.
 */

import { z } from 'zod';
import { CURRENCY_CODES, type CurrencyCode } from '@/config/currencies';
import {
  RAISE_DEFAULT_TERMS,
  RAISE_LIMITS,
  RAISE_RAIL_COPY,
  RAISE_RAILS,
  type RaiseRail,
} from '@/config/raise';

export interface CostLine {
  label: string;
  amount: number;
}

export interface RaisePlan {
  /** The need as the person said it — kept so a re-plan starts from their words. */
  need: string;
  title: string;
  /** The page's story: why, and what changes once it is paid for. */
  story: string;
  currency: CurrencyCode;
  lines: CostLine[];
  rail: RaiseRail;
  /** One sentence on why this rail fits — shown beside the choice. */
  railWhy: string;
  /** True when the prices came from a model's estimate, not the person. */
  estimated: boolean;
  /** Loan interest or expected investment return, percent a year. */
  ratePercent: number;
  termMonths: number;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

/** Whole units for fiat (a project goal is an integer); 8 places for BTC. */
export function roundAmount(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }
  return currency === 'BTC' ? Math.round(amount * 1e8) / 1e8 : Math.round(amount);
}

export function planTotal(plan: Pick<RaisePlan, 'lines' | 'currency'>): number {
  return roundAmount(
    plan.lines.reduce((sum, l) => sum + (l.amount > 0 ? l.amount : 0), 0),
    plan.currency
  );
}

const looseNumber = z.preprocess(
  v => (typeof v === 'string' ? Number(v.replace(/[^0-9.]/g, '')) : v),
  z.number().finite()
);

/** What we accept from a model. Everything is optional; normalizePlan fills gaps. */
export const modelPlanSchema = z.object({
  title: z.string().optional(),
  story: z.string().optional(),
  lines: z
    .array(z.object({ label: z.string(), amount: looseNumber }))
    .optional()
    .catch(undefined),
  rail: z.enum(RAISE_RAILS).optional().catch(undefined),
  rail_why: z.string().optional(),
  rate_percent: looseNumber.optional().catch(undefined),
  term_months: looseNumber.optional().catch(undefined),
});
export type ModelPlan = z.infer<typeof modelPlanSchema>;

/**
 * Turn a model's answer (or nothing) into a valid plan. Every string is
 * clipped, every number clamped, empty lines dropped, and a stated cost in the
 * person's own words beats any estimate.
 */
export function normalizePlan(
  need: string,
  currency: CurrencyCode,
  raw: ModelPlan | null
): RaisePlan {
  const stated = statedCost(need);
  const fromModel = (raw?.lines ?? [])
    .map(l => ({
      label: clip(l.label.trim(), RAISE_LIMITS.lineLabelMax),
      amount: roundAmount(l.amount, currency),
    }))
    .filter(l => l.label && l.amount > 0)
    .slice(0, RAISE_LIMITS.maxLines);

  let lines = fromModel;
  let estimated = fromModel.length > 0;
  if (stated !== null) {
    const modelTotal = planTotal({ lines: fromModel, currency });
    // They said what it costs. Keep the model's breakdown only if it agrees.
    if (Math.abs(modelTotal - stated) > stated * 0.02) {
      lines = [{ label: shortLabel(need), amount: roundAmount(stated, currency) }];
    }
    estimated = false;
  }

  const rail = raw?.rail ?? 'fund';
  const defaults = rail === 'invest' ? RAISE_DEFAULT_TERMS.invest : RAISE_DEFAULT_TERMS.lend;
  const title = clip((raw?.title ?? '').trim() || shortLabel(need), RAISE_LIMITS.titleMax);
  return {
    need: clip(need.trim(), RAISE_LIMITS.needMax),
    title,
    story: clip((raw?.story ?? '').trim() || need.trim(), RAISE_LIMITS.storyMax),
    currency,
    lines,
    rail,
    railWhy: clip((raw?.rail_why ?? '').trim() || RAISE_RAIL_COPY[rail].fits, 200),
    estimated,
    ratePercent: clamp(
      Math.round(raw?.rate_percent ?? defaults.ratePercent),
      0,
      RAISE_LIMITS.rateMax
    ),
    termMonths: clamp(
      Math.round(raw?.term_months ?? defaults.termMonths),
      1,
      RAISE_LIMITS.termMonthsMax
    ),
  };
}

const NUM = String.raw`(\d{1,3}(?:[',’\s]\d{3})+|\d+(?:\.\d+)?)\s*(k)?`;
const PRE = String.raw`(?:chf|eur|usd|gbp|fr\.|€|\$|£)`;
const POST = String.raw`(?:chf|eur|usd|gbp|francs?|euros?|dollars?|pounds?|€|£)`;
const COST_PATTERNS = [
  new RegExp(`${PRE}\\s*${NUM}`, 'i'),
  new RegExp(`${NUM}\\s*${POST}`, 'i'),
  new RegExp(`(?:costs?|about|around|roughly|budget(?: of)?|need)\\s+${NUM}`, 'i'),
];

/** "about CHF 4,000", "4000 francs", "costs 2.5k" → the number, else null. */
export function statedCost(text: string): number | null {
  for (const pattern of COST_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      const n = Number(m[1].replace(/[',’\s]/g, '')) * (m[2] ? 1000 : 1);
      if (Number.isFinite(n) && n > 0) {
        return n;
      }
    }
  }
  return null;
}

/** The need's first clause, capitalised — a title when nothing better exists. */
function shortLabel(need: string): string {
  const first = need.trim().split(/[.!?\n]| — | - |, so | because /)[0] ?? need;
  const t = clip(first.trim(), 60);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function isCurrencyCode(v: unknown): v is CurrencyCode {
  return typeof v === 'string' && (CURRENCY_CODES as readonly string[]).includes(v);
}

/** The page's description: their story, then what it costs, line by line. */
export function composeDescription(plan: RaisePlan, format: (n: number) => string): string {
  const lines = plan.lines.map(l => `- ${l.label}: ${format(l.amount)}`).join('\n');
  const breakdown =
    plan.lines.length > 1 ? `\n\nWhat it costs\n${lines}\nTotal: ${format(planTotal(plan))}` : '';
  return `${plan.story}${breakdown}`.slice(0, 2000);
}

export interface EntityRequest {
  entityType: (typeof RAISE_RAIL_COPY)[RaiseRail]['entityType'];
  payload: Record<string, unknown>;
}

/** The create payload for the rail's entity, valid against its schema. */
export function planToEntityRequest(plan: RaisePlan, format: (n: number) => string): EntityRequest {
  const total = planTotal(plan);
  const description = composeDescription(plan, format);
  const purpose = plan.lines
    .map(l => l.label)
    .join(', ')
    .slice(0, 500);
  const entityType = RAISE_RAIL_COPY[plan.rail].entityType;

  if (plan.rail === 'lend') {
    return {
      entityType,
      payload: {
        title: plan.title,
        description: description.slice(0, 1000),
        original_amount: total,
        remaining_balance: total,
        interest_rate: plan.ratePercent,
        currency: plan.currency,
        preferred_terms: `Repaid over ${plan.termMonths} months at ${plan.ratePercent}% a year.`,
        is_public: true,
      },
    };
  }
  if (plan.rail === 'invest') {
    const minimum = roundAmount(total * RAISE_DEFAULT_TERMS.invest.minimumShare, plan.currency);
    return {
      entityType,
      payload: {
        title: plan.title,
        description: description.length >= 10 ? description : `${description} — ${purpose}`,
        investment_type: 'revenue_share',
        target_amount: total,
        minimum_investment: minimum > 0 ? minimum : total,
        expected_return_rate: plan.ratePercent,
        term_months: plan.termMonths,
        currency: plan.currency,
        is_public: true,
      },
    };
  }
  return {
    entityType,
    payload: {
      title: plan.title,
      description,
      // A project goal is a whole number; a BTC goal below 1 cannot be one.
      goal_amount: plan.currency === 'BTC' ? null : Math.max(1, Math.round(total)),
      currency: plan.currency,
      funding_purpose: purpose || null,
    },
  };
}
