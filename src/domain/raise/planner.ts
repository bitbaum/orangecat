/**
 * The Cat prices a need and drafts how to ask for it.
 *
 * One platform-model call. Whatever comes back goes through normalizePlan,
 * so a model that invents a negative price, a 40-line list or a rail that does
 * not exist cannot reach the page. With no model available, or a model that
 * answers nonsense, the person still gets a plan: their own words as the
 * title and story, the cost they stated (if they did), and a fund rail — the
 * page then asks them for the one number it is missing.
 */

import type { CurrencyCode } from '@/config/currencies';
import { RAISE_LIMITS, RAISE_RAIL_COPY, RAISE_RAILS } from '@/config/raise';
import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';
import { logger } from '@/utils/logger';
import { modelPlanSchema, normalizePlan, type RaisePlan } from './plan';

const rails = RAISE_RAILS.map(
  r => `"${r}" — ${RAISE_RAIL_COPY[r].strings} (${RAISE_RAIL_COPY[r].fits})`
).join('\n');

const SYSTEM = `You help a person raise money for something they need, on a platform where anyone can back, lend to, or invest in anyone.

Given what they need, answer with ONLY JSON:
{
  "title": "a short, warm page title (max 60 chars), in their language",
  "story": "2-4 sentences in first person: what they need, why, and what changes once it is paid for. Honest, specific, no hype, no emojis.",
  "lines": [{"label": "what this part pays for", "amount": 1234}],
  "rail": "fund" | "lend" | "invest",
  "rail_why": "one short sentence on why that rail fits",
  "rate_percent": 0,
  "term_months": 12
}

Rules:
- lines: a realistic price breakdown in CURRENCY, 1-${RAISE_LIMITS.maxLines} lines, typical mid-range prices where they live (assume Switzerland for CHF). Amounts are plain numbers. Include only things the need actually requires.
- If they state what it costs, the lines must add up to exactly that.
- rail — choose from:
${rails}
  Personal hardship, health, creative or community needs → "fund". Equipment or stock that lets a business earn more and repay → "lend". A venture whose profits could be shared → "invest". When unsure → "fund".
- rate_percent: for "lend" a fair yearly interest (0-8); for "invest" an expected yearly return (5-15); for "fund" 0.
- term_months: how long to repay or share returns (6-60); for "fund" 12.
- Never invent facts about the person beyond what they said.`;

export async function planRaise(need: string, currency: CurrencyCode): Promise<RaisePlan> {
  const user = `CURRENCY: ${currency}\n\nWhat I need:\n${need.slice(0, RAISE_LIMITS.needMax)}`;
  try {
    const raw = await callPlatformJson(SYSTEM, user, { temperature: 0.4, maxTokens: 900 });
    const parsed = modelPlanSchema.safeParse(parseJsonLoose(raw) ?? {});
    return normalizePlan(need, currency, parsed.success ? parsed.data : null);
  } catch (error) {
    logger.warn('Raise planner failed; using the person’s own words', { error }, 'Raise');
    return normalizePlan(need, currency, null);
  }
}
