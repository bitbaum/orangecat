/**
 * What the Cat usage numbers mean (services/cat/usage-meaning.ts).
 *
 * The property under test is that /settings/usage says the thing a meter
 * cannot: whether today's pace runs into the cap, whether the cap is a habit
 * rather than an accident, what Cat forgets, and what to press — and that it
 * never offers a plan the person cannot actually buy today.
 *
 * Numbers are checkable by hand: a 10-message free day, observed at 06:00 UTC
 * (a quarter of the day gone).
 */

import { catUsageMeaning, type UsageMeaningInput } from '@/services/cat/usage-meaning';
import { CAT_PLANS } from '@/config/cat-plans';
import { ROUTES } from '@/config/routes';

const SIX_AM = new Date('2026-10-12T06:00:00Z');

function input(over: Partial<UsageMeaningInput> = {}): UsageMeaningInput {
  return {
    now: SIX_AM,
    tier: 'free',
    used: 0,
    limit: 10,
    resetInSeconds: 18 * 3600,
    week: null,
    creditsWeek: null,
    historyMessages: 20,
    ...over,
  };
}

/** The paid levers that are really open in this environment, in the module's order. */
const OPEN_UPGRADES = ['byok', 'supporter', 'credits'].filter(
  id => CAT_PLANS.find(p => p.id === id)?.status === 'available'
);

describe('catUsageMeaning — pace', () => {
  it('says nothing before there is a rate to project', () => {
    expect(catUsageMeaning(input({ used: 1 })).pace).toBeNull();
    expect(
      catUsageMeaning(input({ used: 3, now: new Date('2026-10-12T00:30:00Z') })).pace
    ).toBeNull();
  });

  it('says the day lasts when the rate stays under the cap', () => {
    // 2 by 06:00 → 8 projected for the day, under 10.
    expect(catUsageMeaning(input({ used: 2 })).pace).toBe(
      "At today's pace your 10 messages last the whole day."
    );
  });

  it('names the hour the cap is reached when it does not', () => {
    // 5 by 06:00 → 10 reached at 12:00 UTC.
    expect(catUsageMeaning(input({ used: 5 })).pace).toBe(
      "At today's pace you reach today's 10 around 12:00 UTC, then Cat waits until midnight UTC."
    );
  });

  it('is silent when capped or on their own key — the main card already says it', () => {
    expect(catUsageMeaning(input({ used: 10 })).pace).toBeNull();
    expect(catUsageMeaning(input({ tier: 'byok', used: 40, limit: 10 })).pace).toBeNull();
  });
});

describe('catUsageMeaning — week', () => {
  const week = (counts: number[]) =>
    counts.map((requests, i) => ({ day: `2026-10-0${i + 1}`, requests }));

  it('counts messages, active days, and the days the cap decided when they stopped', () => {
    const m = catUsageMeaning(input({ week: week([10, 0, 4, 10, 2, 0, 3]) })).week;
    expect(m).toMatchObject({ messages: 29, activeDays: 5, cappedDays: 2 });
    expect(m?.line).toBe(
      'This week: 29 messages over 5 days. You reached the daily cap on 2 days — the cap, not your work, decided when you stopped.'
    );
  });

  it('is absent for an empty or unreadable week, never "0 messages"', () => {
    expect(catUsageMeaning(input({ week: week([0, 0, 0]) })).week).toBeNull();
    expect(catUsageMeaning(input({ week: null })).week).toBeNull();
  });

  it('never calls a day capped on their own key', () => {
    expect(catUsageMeaning(input({ tier: 'byok', week: week([50, 50]) })).week?.cappedDays).toBe(0);
  });
});

describe('catUsageMeaning — levers', () => {
  const ids = (m: ReturnType<typeof catUsageMeaning>) => m.actions.map(a => a.id);

  it('a relaxed day offers only Memory', () => {
    expect(ids(catUsageMeaning(input({ used: 1 })))).toEqual(['memory']);
  });

  it('a capped day leads with when it refills, then the plans that are really open', () => {
    const m = catUsageMeaning(input({ used: 10, resetInSeconds: 9 * 3600 }));
    expect(m.actions[0]).toMatchObject({ id: 'wait', label: 'Back in 9 hours' });
    expect(ids(m)).toEqual(['wait', ...OPEN_UPGRADES, 'memory']);
  });

  it('a pace that will hit the cap offers the way past it before it happens', () => {
    expect(ids(catUsageMeaning(input({ used: 5 })))).toEqual([...OPEN_UPGRADES, 'memory']);
  });

  it('a week of capped days offers it even on a quiet morning', () => {
    const m = catUsageMeaning(input({ used: 0, week: [{ day: '2026-10-10', requests: 10 }] }));
    expect(ids(m)).toEqual([...OPEN_UPGRADES, 'memory']);
  });

  it('never offers the plan they are on, or one still activating', () => {
    for (const a of catUsageMeaning(input({ used: 10 })).actions) {
      const plan = CAT_PLANS.find(p => p.id === a.id);
      if (plan) {
        expect(plan.status).toBe('available');
        expect(plan.id).not.toBe('free');
        expect(a.href).toBe(plan.cta.href);
      }
    }
  });

  it('memory links to where memories are kept', () => {
    const memory = catUsageMeaning(input()).actions.find(a => a.id === 'memory');
    expect(memory?.href).toBe(ROUTES.SETTINGS_MEMORY);
  });
});

describe('catUsageMeaning — explanations', () => {
  it('states the history window in messages and back-and-forths', () => {
    expect(catUsageMeaning(input()).memory).toMatch(
      /last 20 messages \(about 10 back-and-forths\)/
    );
  });

  it('keeps every fact the old "What counts" list stated', () => {
    const titles = catUsageMeaning(input()).explain.map(e => e.title);
    expect(titles).toEqual([
      'What a message is',
      'Why there is a daily cap',
      'Resets at midnight UTC',
      'Your own key',
      'Cat Credits',
      'What Cat remembers',
    ]);
    const text = catUsageMeaning(input())
      .explain.map(e => e.body)
      .join(' ');
    expect(text).toMatch(/counts as one/);
    expect(text).toMatch(/never touch the daily cap/);
    expect(text).toMatch(/Image generation is billed to Cat Credits/);
    expect(text).toMatch(/Unused messages don't roll over/);
  });

  it('frontier spend this week appears only when there was some', () => {
    expect(catUsageMeaning(input({ creditsWeek: { messages: 0, btc: 0 } })).creditsWeek).toBeNull();
    expect(
      catUsageMeaning(input({ creditsWeek: { messages: 3, btc: 0.00002 } })).creditsWeek
    ).toEqual({ messages: 3, btc: 0.00002 });
  });
});
