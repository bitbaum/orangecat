/**
 * Unit tests for Cat home — what the Cat opens an empty chat with.
 *
 * The promise: the Cat speaks first, in its own voice, about something real
 * and timely in THIS user's life, and "not now" has somewhere to go. These
 * tests pin that, and that opening the chat never calls a model (the chips
 * used to be LLM-written on page load — a free-tier spend nobody asked for).
 */

import {
  generateCatHome,
  detectOpeners,
  hasRichContext,
  isPlaceholderTitle,
  listAttachable,
} from '@/services/cat/prompt-suggestions';
import { composeDayBrief, localClock } from '@/services/cat/day-brief';
import { STARTER_HOME, getStarterChips, CAT_HOME_MAX_CHIPS } from '@/config/cat-prompts';
import { getEntitiesByCategory } from '@/config/entity-registry';
import type { FullUserContext } from '@/services/ai/document-context';

vi.mock('@/services/cat/platform-llm', () => ({
  callPlatformJson: vi.fn(async () => null),
  parseJsonLoose: vi.fn(),
}));

import { callPlatformJson } from '@/services/cat/platform-llm';

import type { MockedFunction } from 'vitest';

const mockedCall = callPlatformJson as MockedFunction<typeof callPlatformJson>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_STATS = {
  totalProducts: 0,
  totalServices: 0,
  totalProjects: 0,
  totalCauses: 0,
  totalEvents: 0,
  totalAssets: 0,
  totalLoans: 0,
  totalInvestments: 0,
  totalResearch: 0,
  totalWishlists: 0,
  totalTasks: 0,
  urgentTasks: 0,
  totalWallets: 0,
};

const EMPTY_PAYMENT: import('@/services/ai/document-context').PaymentCapabilities = {
  hasNwcWallet: false,
  lightningAddress: null,
};

function makeContext(overrides: Partial<FullUserContext> = {}): FullUserContext {
  return {
    profile: null,
    documents: [],
    entities: [],
    tasks: [],
    wallets: [],
    conversations: [],
    paymentCapabilities: EMPTY_PAYMENT,
    stats: { ...EMPTY_STATS },
    ...overrides,
  } as FullUserContext;
}

function makeEntity(
  type: string,
  title: string,
  overrides: Partial<import('@/services/ai/document-context').EntitySummary> = {}
): import('@/services/ai/document-context').EntitySummary {
  return {
    id: crypto.randomUUID(),
    type,
    title,
    status: 'active',
    description: 'A described thing',
    price_btc: 0.001,
    ...overrides,
  };
}

function makeWallet(): import('@/services/ai/document-context').WalletSummary {
  return {
    label: 'Savings',
    description: null,
    category: 'savings',
    behavior_type: 'goal',
    goal_amount: 0.01,
    goal_currency: 'BTC',
    goal_deadline: null,
    budget_amount: null,
    budget_period: null,
    is_primary: false,
    has_nwc: false,
    lightning_address: null,
  };
}

const PAID_UP = { ...EMPTY_PAYMENT, lightningAddress: 'me@orangecat.ch' };

/** A user with a bio, so the "no bio" opener doesn't shadow the case under test. */
const PROFILE = { name: 'Alice', username: 'alice', bio: 'Ceramicist in Zürich' };

beforeEach(() => {
  mockedCall.mockClear();
  mockedCall.mockResolvedValue(null);
});

// ─── Starters are derived, not written ───────────────────────────────────────

describe('starter chips', () => {
  it('derives one chip per top business entity type in the registry', () => {
    const business = getEntitiesByCategory().business.slice(0, 3);
    const starters = getStarterChips();
    expect(starters).toHaveLength(business.length);
    business.forEach((meta, i) => {
      expect(starters[i].toLowerCase()).toContain(meta.name.toLowerCase());
    });
  });
});

// ─── hasRichContext ───────────────────────────────────────────────────────────

describe('hasRichContext', () => {
  it('returns false for empty or blank profile-only context', () => {
    expect(hasRichContext(makeContext())).toBe(false);
    expect(
      hasRichContext(
        makeContext({ profile: { username: 'alice', name: null, bio: null, background: null } })
      )
    ).toBe(false);
  });

  it('returns true when there is a name, entity, or wallet', () => {
    expect(hasRichContext(makeContext({ profile: { name: 'Alice', username: 'alice' } }))).toBe(
      true
    );
    expect(hasRichContext(makeContext({ entities: [makeEntity('product', 'Mug')] }))).toBe(true);
    expect(hasRichContext(makeContext({ wallets: [makeWallet()] }))).toBe(true);
  });
});

// ─── Openers: the Cat speaking, about real things ─────────────────────────────

describe('detectOpeners', () => {
  it('speaks as the Cat, never as the user addressing it', () => {
    const openers = detectOpeners(
      makeContext({
        profile: { name: 'Alice', username: 'alice' },
        entities: [makeEntity('product', 'Blue Vase', { status: 'draft', description: '' })],
      })
    );
    expect(openers.length).toBeGreaterThan(0);
    for (const o of openers) {
      expect(o.say).not.toMatch(/^cat[,:]/i);
      expect(o.replies.length).toBeGreaterThan(0);
      o.replies.forEach(r => expect(r).not.toMatch(/^cat[,:]/i));
    }
  });

  it('quotes the exact unread total, not the sum of the coalesced newest rows', () => {
    const group = {
      type: 'system',
      title: 'Cat eval harness error',
      message: 'failed',
      count: 30,
      latest_at: '2026-09-23T10:00:00Z',
      action_url: null,
    };
    const say = (ctx: Partial<FullUserContext>) =>
      detectOpeners(makeContext({ profile: PROFILE, notifications: [group], ...ctx })).find(o =>
        o.key.startsWith('notifications:')
      )?.say;
    expect(say({ notificationsUnread: 80 })).toContain('80 unread notifications');
    expect(say({})).toContain('30 unread notifications');
  });

  it('puts something that HAPPENED ahead of a chore', () => {
    const [top] = detectOpeners(
      makeContext({
        profile: PROFILE,
        entities: [makeEntity('product', 'Blue Vase', { status: 'draft' })],
        inboundActivity: {
          recentSales: [
            {
              entity_title: 'Pottery Class',
              entity_type: 'service',
              amount_btc: 0.001,
              status: 'paid',
              created_at: '2026-09-23T10:00:00Z',
            },
          ],
          upcomingBookings: [],
        },
      })
    );
    expect(top.say).toContain('Pottery Class');
    expect(top.key).toMatch(/^sales:/);
  });

  it('brings up an overdue task by name', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        tasks: [
          {
            id: 't1',
            title: 'Send invoice',
            category: 'admin',
            priority: 'high',
            current_status: 'idle',
            task_type: 'one_time',
            due_date: '2026-09-01T00:00:00Z',
          },
        ],
      }),
      new Date('2026-09-24T00:00:00Z')
    );
    expect(openers[0].key).toBe('task:t1');
    expect(openers[0].say).toContain('Send invoice');
  });

  it('builds on a goal the user told the Cat about', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        economicProfile: {
          skills: [],
          assets: [],
          goals: [{ text: 'Earn 2k a month from ceramics' }],
          constraints: [],
          askedFor: [],
          notAvailableFor: [],
        },
      })
    );
    expect(openers.some(o => o.say.includes('Earn 2k a month from ceramics'))).toBe(true);
  });

  it('never spotlights a test or placeholder draft', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        wallets: [makeWallet()],
        entities: [makeEntity('service', 'Test Service - Web Development', { status: 'draft' })],
      })
    );
    expect(openers.some(o => o.say.includes('Test Service'))).toBe(false);
  });

  it('talks about several drafts as one pile, not one arbitrary spotlight', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        wallets: [makeWallet()],
        entities: [
          makeEntity('product', 'Alpha', { status: 'draft' }),
          makeEntity('product', 'Beta', { status: 'draft' }),
          makeEntity('product', 'Gamma', { status: 'draft' }),
        ],
      })
    );
    const drafts = openers.filter(o => o.key.startsWith('draft'));
    expect(drafts).toHaveLength(1);
    expect(drafts[0].say).toContain('3 drafts');
  });

  it('keys a single draft by its id, so dismissing it is specific', () => {
    const draft = makeEntity('product', 'Handmade Candles', { status: 'draft' });
    const openers = detectOpeners(
      makeContext({ profile: PROFILE, wallets: [makeWallet()], entities: [draft] })
    );
    const o = openers.find(x => x.key === `draft:${draft.id}`);
    expect(o?.say).toContain('Handmade Candles');
    expect(o?.replies[0]).toContain('Handmade Candles');
  });

  it('flags the payment gap when listings exist but money cannot arrive', () => {
    const openers = detectOpeners(
      makeContext({ profile: PROFILE, entities: [makeEntity('product', 'Handmade Candles')] })
    );
    expect(openers.find(o => o.key === 'payment')?.say).toContain('1 listing');
  });

  it('does not invent a price gap for entities not sold at a price', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        paymentCapabilities: PAID_UP,
        entities: [makeEntity('cause', 'Clean Water', { price_btc: 0 })],
      })
    );
    expect(openers.some(o => o.key.startsWith('price:'))).toBe(false);
  });

  it('falls through to demand once a listing is live and payable', () => {
    const openers = detectOpeners(
      makeContext({
        profile: PROFILE,
        paymentCapabilities: PAID_UP,
        entities: [makeEntity('service', 'Pottery Classes')],
      })
    );
    expect(openers[0].key).toMatch(/^demand:/);
    expect(openers[0].replies.join(' ')).toContain('Pottery Classes');
  });

  it('gives every opener a unique key', () => {
    const openers = detectOpeners(
      makeContext({
        profile: { name: 'Alice', username: 'alice' },
        entities: [
          makeEntity('product', 'A', { status: 'draft' }),
          makeEntity('product', 'B', { description: '' }),
          makeEntity('product', 'C', { price_btc: 0 }),
        ],
      })
    );
    expect(new Set(openers.map(o => o.key)).size).toBe(openers.length);
  });
});

// ─── The day brief: what is waiting, counted, for THEIR day ───────────────────

describe('localClock', () => {
  it("reads the person's wall clock, not the server's", () => {
    // 05:05 UTC in November is 06:05 in Zürich and still the evening before in LA.
    const now = new Date('2026-11-12T05:05:00Z');
    expect(localClock(now, 'Europe/Zurich')).toMatchObject({
      day: '2026-11-12',
      hour: 6,
      part: 'morning',
    });
    expect(localClock(now, 'America/Los_Angeles')).toMatchObject({
      day: '2026-11-11',
      part: 'evening',
    });
  });

  it('falls back to UTC for a zone the runtime does not know', () => {
    expect(localClock(new Date('2026-11-12T05:05:00Z'), 'Not/AZone').zone).toBe('UTC');
  });
});

describe('composeDayBrief', () => {
  const ZURICH = 'Europe/Zurich';
  const morning = new Date('2026-11-12T05:05:00Z');
  const lokiProject = (
    name: string,
    over: Partial<NonNullable<FullUserContext['lokiProjects']>[number]> = {}
  ) => ({
    id: name,
    name,
    lokiUrl: `https://loki.example/${name}`,
    liveUrl: null,
    status: 'idle' as const,
    blockReason: null,
    queueDepth: 0,
    currentWork: null,
    recentOutcomes: [],
    feedback: { new: 0, open: 0 },
    orangecat: [],
    ...over,
  });
  const task = (id: string, due_date: string) => ({
    id,
    title: id,
    category: 'admin',
    priority: 'normal',
    current_status: 'idle',
    task_type: 'one_time',
    due_date,
  });

  it('counts everything waiting, Loki first, in one or two sentences', () => {
    const brief = composeDayBrief(
      makeContext({
        profile: PROFILE,
        lokiProjects: [
          lokiProject('orangecat', { status: 'blocked', blockReason: 'awaiting_user' }),
          lokiProject('loki', { feedback: { new: 2, open: 2 } }),
        ],
        tasks: [task('a', '2026-11-12T15:00:00Z'), task('b', '2026-11-01T09:00:00Z')],
        notificationsUnread: 14,
        notifications: [
          { type: 'system', title: 'x', message: '', count: 1, latest_at: '', action_url: null },
        ],
      }),
      morning,
      ZURICH
    );
    expect(brief.say).toBe(
      'Loki is waiting on you in "orangecat". You have 1 task due today, 1 overdue task, ' +
        '2 new pieces of feedback on "loki" and 14 unread notifications.'
    );
  });

  it('offers the reply that fits the hour', () => {
    const ctx = makeContext({ profile: PROFILE });
    expect(composeDayBrief(ctx, morning, ZURICH).replies[0]).toBe("Let's start my day");
    expect(composeDayBrief(ctx, new Date('2026-11-12T14:00:00Z'), ZURICH).replies[0]).toMatch(
      /this afternoon/
    );
    expect(composeDayBrief(ctx, new Date('2026-11-12T20:00:00Z'), ZURICH).replies[0]).toMatch(
      /wrap up/
    );
  });

  it('says so plainly when nothing is waiting, and invents nothing', () => {
    expect(composeDayBrief(makeContext({ profile: PROFILE }), morning, ZURICH).say).toBe(
      'Nothing is waiting on you this morning.'
    );
  });

  it('is a new opener each day, each part of day, and whenever what it says changes', () => {
    const ctx = makeContext({ profile: PROFILE });
    const key = (now: string, c = ctx) => composeDayBrief(c, new Date(now), ZURICH).key;
    const today = key('2026-11-12T05:05:00Z');
    expect(key('2026-11-12T06:30:00Z')).toBe(today);
    expect(key('2026-11-13T05:05:00Z')).not.toBe(today);
    expect(key('2026-11-12T14:00:00Z')).not.toBe(today);
    expect(
      key(
        '2026-11-12T05:05:00Z',
        makeContext({
          profile: PROFILE,
          notificationsUnread: 3,
          notifications: [
            { type: 'system', title: 'x', message: '', count: 3, latest_at: '', action_url: null },
          ],
        })
      )
    ).not.toBe(today);
  });

  it("only counts a booking that falls on the person's today", () => {
    const booking = (starts_at: string) => ({
      starts_at,
      ends_at: null,
      status: 'confirmed',
      customer_display_name: 'Ben',
      customer_username: 'ben',
    });
    const say = (starts_at: string) =>
      composeDayBrief(
        makeContext({
          profile: PROFILE,
          inboundActivity: { recentSales: [], upcomingBookings: [booking(starts_at)] },
        }),
        morning,
        ZURICH
      ).say;
    expect(say('2026-11-12T13:00:00Z')).toBe('You have a booking with Ben at 14:00.');
    expect(say('2026-11-13T13:00:00Z')).toBe('Nothing is waiting on you this morning.');
  });
});

describe('isPlaceholderTitle', () => {
  it.each(['Test Service - Web Development', 'untitled', 'Demo product', 'asdf'])(
    'treats "%s" as a placeholder',
    t => expect(isPlaceholderTitle(t)).toBe(true)
  );
  it.each(['Loki Pro — 30-day pass', 'Testament Leather Goods', 'Handmade Candles'])(
    'treats "%s" as real',
    t => expect(isPlaceholderTitle(t)).toBe(false)
  );
});

// ─── Composition ──────────────────────────────────────────────────────────────

describe('generateCatHome', () => {
  it('returns the starter home for a user the Cat knows nothing about', async () => {
    expect(await generateCatHome('u-empty', makeContext())).toEqual(STARTER_HOME);
  });

  it("opens with something from the user's own state", async () => {
    const home = await generateCatHome(
      'u-nollm',
      makeContext({ profile: PROFILE, entities: [makeEntity('product', 'Handmade Candles')] })
    );
    expect(home.openers.length).toBeGreaterThan(0);
    expect(home.chips.length).toBeGreaterThan(0);
    expect(home.chips.length).toBeLessThanOrEqual(CAT_HOME_MAX_CHIPS);
  });

  it('leads with the day brief and keeps the single facts behind it', async () => {
    const home = await generateCatHome(
      'u-brief',
      makeContext({ profile: PROFILE, entities: [makeEntity('product', 'Handmade Candles')] }),
      [],
      { now: new Date('2026-11-12T05:05:00Z'), zone: 'Europe/Zurich' }
    );
    expect(home.openers[0].key).toMatch(/^day:2026-11-12:morning:/);
    expect(home.openers[0].replies).toEqual(["Let's start my day"]);
    expect(home.openers.slice(1).some(o => o.key === 'payment')).toBe(true);
  });

  it('turns the standing chips with the calendar day, so two mornings differ', async () => {
    const ctx = makeContext({
      profile: { name: 'Alice', username: 'alice' },
      entities: [
        makeEntity('product', 'A', { status: 'draft' }),
        makeEntity('product', 'B', { description: '' }),
        makeEntity('product', 'C', { price_btc: 0 }),
      ],
    });
    const chipsOn = async (day: string) =>
      (await generateCatHome('u-turn', ctx, [], { now: new Date(`${day}T08:00:00Z`), zone: 'UTC' }))
        .chips;
    expect(await chipsOn('2026-11-12')).not.toEqual(await chipsOn('2026-11-13'));
  });

  it('never offers a chip that points at something off screen', async () => {
    const home = await generateCatHome(
      'u-goal',
      makeContext({
        profile: PROFILE,
        economicProfile: {
          skills: [],
          assets: [],
          goals: [{ text: 'Earn 2k a month from ceramics' }],
          constraints: [],
          askedFor: [],
          notAvailableFor: [],
        },
      })
    );
    expect(home.chips.join(' ')).toContain('Earn 2k a month from ceramics');
    home.chips.forEach(c => expect(c).not.toMatch(/\b(it|this|that)\?$/i));
  });

  it('never calls a model, even for a user with rich state and memories', async () => {
    const home = await generateCatHome(
      'u-nomodel',
      makeContext({ profile: PROFILE, entities: [makeEntity('product', 'Handmade Candles')] }),
      ['Runs a pottery studio in Zürich']
    );
    expect(home.chips.length).toBeGreaterThan(0);
    expect(mockedCall).not.toHaveBeenCalled();
  });

  it('offers the user’s own things to the "+" menu', async () => {
    const home = await generateCatHome(
      'u-attach',
      makeContext({ profile: PROFILE, entities: [makeEntity('product', 'Blue Vase')] })
    );
    expect(home.attachable.map(a => a.title)).toContain('Blue Vase');
  });
});

describe('listAttachable', () => {
  it('lists listings before notes', () => {
    const refs = listAttachable(
      makeContext({
        entities: [makeEntity('product', 'Blue Vase')],
        documents: [
          { id: 'd1', title: 'Goals', content: '', document_type: 'goals', visibility: 'private' },
        ],
      })
    );
    expect(refs.map(r => r.type)).toEqual(['product', 'document']);
  });
});
