/**
 * What the Cat usage numbers MEAN — the half a meter leaves out.
 *
 * /settings/usage already said "4 of 10 messages left today, resets in 9 h".
 * That is accurate and answers only "how much". It does not say whether
 * today's pace runs into the cap before evening, whether the cap is something
 * this person keeps hitting, what Cat forgets as a conversation grows, or what
 * to press. This module is that half, as plain sentences and levers.
 *
 * Pure: no DB, no HTTP, no clock beyond `now`. The reads live in
 * usage-summary.ts and the page only renders, so every sentence here is
 * tested with plain numbers. The product-neutral half — the pace forecast,
 * the seven-day summary, refill wording, the history-window sentence, the
 * reset explanation and the action type — is @bitbaum/ai-kit's, shared with
 * Loki, so every app phrases a budget the same way. What stays here is
 * OrangeCat's: plans, the cap's reason, credits, and the levers.
 *
 * Plan facts are imported, never typed: the levers are CAT_PLANS rows the
 * person is not on and can actually buy today, so a plan that is still
 * "activating" is never offered as a button.
 */

import {
  countOf,
  historyWindowLine,
  paceForecast,
  paceLine,
  refillsIn,
  utcResetExplanation,
  weekSummary,
  type UsageAction as KitUsageAction,
} from '@bitbaum/ai-kit';
import { CAT_PLANS, PLAN_ID_BY_QUOTA_TIER, type CatPlanId } from '@/config/cat-plans';
import { COMMERCE_CLOSED } from '@/config/commerce';
import { ROUTES } from '@/config/routes';
import type { CatTier } from '@/services/cat/quota-helpers';
import { formatNumber } from '@/utils/locale';

export interface UsageMeaningInput {
  now: Date;
  tier: CatTier;
  /** Messages counted today. */
  used: number;
  /** Today's cap for this tier. */
  limit: number;
  /** Seconds until the daily counter resets. */
  resetInSeconds: number;
  /** Messages per UTC day for the last seven days, today included. Null when unreadable. */
  week: { day: string; requests: number }[] | null;
  /** Frontier messages paid from Cat Credits in the last seven days. Null when unreadable. */
  creditsWeek: { messages: number; btc: number } | null;
  /** How many past messages Cat reads into a reply (HISTORY_INJECTION_LIMIT). */
  historyMessages: number;
}

/** A lever and its consequence — the shared shape, with OrangeCat's ids. */
export type UsageAction = KitUsageAction<CatPlanId | 'wait'>;

export interface UsageMeaning {
  /** "At today's pace you reach your 10 around 15:00 UTC." Null when there is no rate to speak of. */
  pace: string | null;
  week: {
    messages: number;
    activeDays: number;
    /** Days in the last seven on which the cap was reached. */
    cappedDays: number;
    line: string;
  } | null;
  /** BTC is formatted by the page through useDisplayCurrency, never here. */
  creditsWeek: { messages: number; btc: number } | null;
  memory: string;
  /** Reference text; `link` is where the person acts on that fact. */
  explain: { title: string; body: string; link?: { label: string; href: string } }[];
  actions: UsageAction[];
}

const count = (n: number) => formatNumber(n);
const plural = (n: number, word: string) => countOf(n, word, { format: count });

/** Today's forecast, and whether it runs into the cap — the second half drives the levers. */
function paceOf(input: UsageMeaningInput): { line: string; reachesCap: boolean } | null {
  if (input.tier === 'byok') {
    return null;
  }
  const forecast = paceForecast({ used: input.used, limit: input.limit, now: input.now });
  const line = paceLine(forecast, {
    subject: `your ${count(input.limit)} messages`,
    plural: true,
    then: ', then Cat waits until midnight UTC',
  });
  return forecast && line ? { line, reachesCap: !forecast.lastsTheDay } : null;
}

function weekOf(input: UsageMeaningInput): UsageMeaning['week'] {
  // Measured against TODAY's cap: a day spent on the free tier before a
  // Supporter upgrade would otherwise read as capped at the higher number.
  const summary = weekSummary(
    input.week?.map(d => ({ used: d.requests })) ?? null,
    input.tier === 'byok' ? null : input.limit
  );
  if (!summary) {
    return null;
  }
  const capped =
    summary.cappedDays > 0
      ? ` You reached the daily cap on ${plural(summary.cappedDays, 'day')} — the cap, not your work, decided when you stopped.`
      : '';
  return {
    messages: summary.total,
    activeDays: summary.activeDays,
    cappedDays: summary.cappedDays,
    // The read is the last seven UTC days, today included — not a calendar
    // week, so it does not say "this week".
    line: `Last 7 days: ${plural(summary.total, 'message')} on ${plural(summary.activeDays, 'day')}.${capped}`,
  };
}

function actionsFor(
  input: UsageMeaningInput,
  week: UsageMeaning['week'],
  pace: ReturnType<typeof paceOf>
): UsageAction[] {
  const actions: UsageAction[] = [];
  const remaining = input.limit - input.used;
  const capped = input.tier !== 'byok' && remaining <= 0;
  const pressed =
    input.tier !== 'byok' &&
    (capped || remaining <= 2 || (week?.cappedDays ?? 0) > 0 || pace?.reachesCap === true);

  if (capped) {
    actions.push({
      id: 'wait',
      label: `Back ${refillsIn(input.now.getTime() + input.resetInSeconds * 1000, input.now.getTime()) ?? 'at midnight UTC'}`,
      why: 'Your messages refill at midnight UTC — nothing to do if that is soon enough.',
    });
  }

  if (pressed) {
    const current = PLAN_ID_BY_QUOTA_TIER[input.tier];
    // Order is the plan list's order of "least commitment first" for someone
    // who has run out: their own key (free to OrangeCat, available now), then
    // whatever paid plan is actually open.
    for (const id of ['byok', 'supporter', 'credits'] as const) {
      const plan = CAT_PLANS.find(p => p.id === id);
      if (!plan || plan.id === current || plan.status !== 'available') {
        continue;
      }
      actions.push({ id: plan.id, label: plan.cta.label, why: plan.tagline, href: plan.cta.href });
    }
  }

  return actions;
}

export function catUsageMeaning(input: UsageMeaningInput): UsageMeaning {
  const week = weekOf(input);
  const memory = historyWindowLine({
    assistant: 'Cat',
    items: input.historyMessages,
    unit: 'message',
    memory: 'Memory',
    format: count,
  });

  // Plan facts decide tense: a plan nobody can buy yet is described as
  // planned, never as something people already do.
  const isOpen = (id: CatPlanId) => CAT_PLANS.find(p => p.id === id)?.status === 'available';

  const explain: UsageMeaning['explain'] = [
    {
      title: 'What a message is',
      // The counter is incremented after a reply is produced (chat-orchestrator:
      // incrementPlatformUsage runs once per answered turn), so a failed reply
      // is free — worth saying, because people retry.
      body:
        'Every message Cat answers on the free or Supporter plan counts as one, however long it ' +
        'is and however much Cat has to look up to answer it. A message Cat could not answer ' +
        "doesn't count.",
    },
    {
      title: 'Why there is a daily cap',
      body:
        'The free models run on a pool OrangeCat provides for everyone. A cap per person is what ' +
        'keeps it free and keeps it there for whoever arrives later in the day.' +
        (isOpen('supporter')
          ? ' Supporters fund that pool.'
          : ' A Supporter plan that funds the pool is planned; it is not open yet.'),
    },
    // The counter is one row per UTC date (platform_api_usage.usage_date =
    // CURRENT_DATE on a UTC database). The shared sentence states only that,
    // with no reason: "the providers refill at midnight" is false of Groq.
    utcResetExplanation('messages'),
    {
      title: 'Your own key',
      body:
        'Messages through your own API key never touch the daily cap. Your provider bills you ' +
        'directly and OrangeCat never marks it up.',
    },
    {
      title: 'Cat Credits',
      body:
        'Frontier models paid with Cat Credits are metered per message from your balance, not ' +
        'from the daily cap. Image generation is billed to Cat Credits too.' +
        (isOpen('credits') ? '' : ` Top-ups are closed for now — ${COMMERCE_CLOSED.short}`),
    },
    {
      title: 'What Cat remembers',
      body: memory,
      link: { label: 'See what Cat remembers', href: ROUTES.SETTINGS_MEMORY },
    },
  ];

  const pace = paceOf(input);
  // Levers only: what changes the cap. Memory is not a lever on the cap, and
  // offering it on every visit put the same paragraph on the page twice.
  const actions = actionsFor(input, week, pace);

  return {
    pace: pace?.line ?? null,
    week,
    creditsWeek: input.creditsWeek && input.creditsWeek.messages > 0 ? input.creditsWeek : null,
    memory,
    explain,
    actions,
  };
}
