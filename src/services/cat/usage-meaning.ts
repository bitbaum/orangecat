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
 * tested with plain numbers. The same shape exists in Loki
 * (lib/ai/budget-view.ts → `meaning`); both are candidates for
 * @bitbaum/ai-kit once the wording settles, so every product phrases a
 * budget the same way.
 *
 * Plan facts are imported, never typed: the levers are CAT_PLANS rows the
 * person is not on and can actually buy today, so a plan that is still
 * "activating" is never offered as a button.
 */

import { CAT_PLANS, PLAN_ID_BY_QUOTA_TIER, type CatPlanId } from '@/config/cat-plans';
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

export interface UsageAction {
  id: CatPlanId | 'wait' | 'memory';
  label: string;
  /** The consequence, so a button is never a bare verb. */
  why: string;
  href?: string;
}

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
  explain: { title: string; body: string }[];
  actions: UsageAction[];
}

/** A rate needs more than one message and a sliver of the day before it is a forecast. */
const PACE_MIN_MESSAGES = 2;
const PACE_MIN_DAY_FRACTION = 0.05;

const count = (n: number) => formatNumber(n);
const plural = (n: number, word: string) => `${count(n)} ${word}${n === 1 ? '' : 's'}`;

function dayFraction(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.min(1, Math.max(0, (now.getTime() - start) / 86_400_000));
}

/** "15:00 UTC" for a fraction of the day. */
function clockAt(fraction: number): string {
  const mins = Math.round(Math.min(1, Math.max(0, fraction)) * 24 * 60);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC`;
}

/** "in 9 hours", "in 40 minutes" — coarse on purpose; the page shows the exact countdown. */
function resetWords(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) {
    return `in ${plural(mins, 'minute')}`;
  }
  return `in ${plural(Math.round(mins / 60), 'hour')}`;
}

/** Today's forecast, and whether it runs into the cap — the second half drives the levers. */
function paceOf(input: UsageMeaningInput): { line: string; reachesCap: boolean } | null {
  if (input.tier === 'byok' || input.limit <= 0) {
    return null;
  }
  const remaining = input.limit - input.used;
  if (remaining <= 0) {
    return null;
  }
  const elapsed = dayFraction(input.now);
  if (input.used < PACE_MIN_MESSAGES || elapsed < PACE_MIN_DAY_FRACTION) {
    return null;
  }
  const projected = input.used / elapsed;
  if (projected <= input.limit) {
    return {
      line: `At today's pace your ${count(input.limit)} messages last the whole day.`,
      reachesCap: false,
    };
  }
  const reachAt = (input.limit / input.used) * elapsed;
  return {
    line: `At today's pace you reach today's ${count(input.limit)} around ${clockAt(reachAt)}, then Cat waits until midnight UTC.`,
    reachesCap: true,
  };
}

function weekOf(input: UsageMeaningInput): UsageMeaning['week'] {
  if (!input.week) {
    return null;
  }
  const messages = input.week.reduce((n, d) => n + Math.max(0, d.requests), 0);
  if (messages === 0) {
    return null;
  }
  const activeDays = input.week.filter(d => d.requests > 0).length;
  // Measured against TODAY's cap: a day spent on the free tier before a
  // Supporter upgrade would otherwise read as capped at the higher number.
  const cappedDays =
    input.tier === 'byok' || input.limit <= 0
      ? 0
      : input.week.filter(d => d.requests >= input.limit).length;
  const capped =
    cappedDays > 0
      ? ` You reached the daily cap on ${plural(cappedDays, 'day')} — the cap, not your work, decided when you stopped.`
      : '';
  return {
    messages,
    activeDays,
    cappedDays,
    line: `This week: ${plural(messages, 'message')} over ${plural(activeDays, 'day')}.${capped}`,
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
      label: `Back ${resetWords(input.resetInSeconds)}`,
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
  const memory =
    `In a conversation Cat reads your last ${count(input.historyMessages)} messages ` +
    `(about ${count(Math.floor(input.historyMessages / 2))} back-and-forths); anything older it no ` +
    `longer sees. What should outlast that belongs in Memory — Cat recalls the relevant ` +
    `memories in every chat.`;

  const explain: UsageMeaning['explain'] = [
    {
      title: 'What a message is',
      body:
        'Every message you send to Cat on the free or Supporter plan counts as one, however long it ' +
        'is and however much Cat has to look up to answer it.',
    },
    {
      title: 'Why there is a daily cap',
      body:
        'The free models run on a pool OrangeCat provides for everyone. A cap per person is what ' +
        'keeps it free and keeps it there for whoever arrives later in the day. Supporters fund ' +
        'that pool.',
    },
    {
      title: 'Resets at midnight UTC',
      body:
        "Because that is when the model providers' free allowances refill, so the counter follows " +
        "their clock, not yours. Unused messages don't roll over.",
    },
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
        'from the daily cap. Image generation is billed to Cat Credits too.',
    },
    { title: 'What Cat remembers', body: memory },
  ];

  const pace = paceOf(input);
  const actions = actionsFor(input, week, pace);
  actions.push({
    id: 'memory',
    label: 'See what Cat remembers',
    why: 'Facts saved there outlast a long conversation.',
    href: ROUTES.SETTINGS_MEMORY,
  });

  return {
    pace: pace?.line ?? null,
    week,
    creditsWeek: input.creditsWeek && input.creditsWeek.messages > 0 ? input.creditsWeek : null,
    memory,
    explain,
    actions,
  };
}
