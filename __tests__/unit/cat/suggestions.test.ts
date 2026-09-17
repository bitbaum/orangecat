/**
 * Unit tests for the Cat prompt-suggestion engine.
 *
 * The engine's promise is that a suggestion is EARNED: it names something the
 * user actually has, and the lead states why it leads. These tests pin that
 * contract, plus the degradation path when the platform LLM is unavailable
 * (which is the normal case in CI — callPlatformJson is mocked to null).
 */

import {
  generatePromptSuggestions,
  detectGaps,
  hasRichContext,
} from '@/services/cat/prompt-suggestions';
import { STARTER_PROMPTS, getStarterPrompts } from '@/config/cat-prompts';
import { getEntitiesByCategory } from '@/config/entity-registry';
import type { FullUserContext } from '@/services/ai/document-context';

vi.mock('@/services/cat/platform-llm', async () => ({
  callPlatformJson: vi.fn(async () => null),
  parseJsonLoose: ((await vi.importActual('@/services/cat/platform-llm')) as any).parseJsonLoose,
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

/** A user with a bio, so the "no bio" gap doesn't shadow the case under test. */
const PROFILE = { name: 'Alice', username: 'alice', bio: 'Ceramicist in Zürich' };

beforeEach(() => {
  mockedCall.mockClear();
  mockedCall.mockResolvedValue(null);
});

// ─── Starter prompts are derived, not written ─────────────────────────────────

describe('starter prompts', () => {
  it('derives one prompt per top business entity type in the registry', () => {
    const business = getEntitiesByCategory().business.slice(0, 3);
    const starters = getStarterPrompts();
    expect(starters).toHaveLength(business.length);
    business.forEach((meta, i) => {
      expect(starters[i].prompt.toLowerCase()).toContain(meta.name.toLowerCase());
    });
  });

  it('offers a fork of equals — no starter claims to be a recommendation', () => {
    expect(STARTER_PROMPTS.every(s => s.reason === undefined)).toBe(true);
  });
});

// ─── hasRichContext ───────────────────────────────────────────────────────────

describe('hasRichContext', () => {
  it('returns false for completely empty context', () => {
    expect(hasRichContext(makeContext())).toBe(false);
  });

  it('returns true when profile has a name', () => {
    expect(hasRichContext(makeContext({ profile: { name: 'Alice', username: 'alice' } }))).toBe(
      true
    );
  });

  it('returns false when profile exists but is blank', () => {
    const ctx = makeContext({
      profile: { username: 'alice', name: null, bio: null, background: null },
    });
    expect(hasRichContext(ctx)).toBe(false);
  });

  it('returns true when there is at least one entity', () => {
    expect(hasRichContext(makeContext({ entities: [makeEntity('product', 'Mug')] }))).toBe(true);
  });

  it('returns true when there is at least one wallet', () => {
    expect(hasRichContext(makeContext({ wallets: [makeWallet()] }))).toBe(true);
  });
});

// ─── Gap detection: every gap names a real thing ──────────────────────────────

describe('detectGaps', () => {
  it('leads with the payment gap when listings exist but money cannot arrive', () => {
    const ctx = makeContext({
      profile: PROFILE,
      entities: [makeEntity('product', 'Handmade Candles')],
    });
    const [top] = detectGaps(ctx);
    expect(top.reason).toContain('1 listing');
    expect(top.prompt.toLowerCase()).toContain('paid');
  });

  it('flags an unpublished draft by name', () => {
    const ctx = makeContext({
      profile: PROFILE,
      wallets: [makeWallet()],
      entities: [makeEntity('product', 'Handmade Candles', { status: 'draft' })],
    });
    const gaps = detectGaps(ctx);
    expect(gaps[0].prompt).toContain('Handmade Candles');
    expect(gaps[0].reason).toContain('draft');
  });

  it('flags a published listing with no description by name', () => {
    const ctx = makeContext({
      profile: PROFILE,
      paymentCapabilities: PAID_UP,
      entities: [makeEntity('product', 'Blue Vase', { description: '  ' })],
    });
    const gaps = detectGaps(ctx);
    expect(gaps[0].prompt).toContain('Blue Vase');
    expect(gaps[0].reason).toContain('no description');
  });

  it('flags a fixed-price listing with no price by name', () => {
    const ctx = makeContext({
      profile: PROFILE,
      paymentCapabilities: PAID_UP,
      entities: [makeEntity('product', 'Blue Vase', { price_btc: 0 })],
    });
    const gaps = detectGaps(ctx);
    expect(gaps.some(g => g.prompt.includes('charge') && g.prompt.includes('Blue Vase'))).toBe(
      true
    );
  });

  it('does not invent a price gap for entities that are not sold at a price', () => {
    const ctx = makeContext({
      profile: PROFILE,
      paymentCapabilities: PAID_UP,
      entities: [makeEntity('cause', 'Clean Water', { price_btc: 0 })],
    });
    expect(detectGaps(ctx).some(g => g.prompt.includes('charge'))).toBe(false);
  });

  it('falls through to demand once the listing is live and payable', () => {
    const ctx = makeContext({
      profile: PROFILE,
      paymentCapabilities: PAID_UP,
      entities: [makeEntity('service', 'Pottery Classes')],
    });
    const gaps = detectGaps(ctx);
    expect(gaps[0].prompt).toContain('Pottery Classes');
    expect(gaps[0].reason).toContain('demand');
  });

  it('every gap states a reason — a suggestion that cannot justify itself is not one', () => {
    const ctx = makeContext({
      profile: { name: 'Alice', username: 'alice' },
      entities: [makeEntity('product', 'Blue Vase', { status: 'draft', description: null })],
    });
    const gaps = detectGaps(ctx);
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps.every(g => !!g.reason?.trim())).toBe(true);
  });
});

// ─── Composition ──────────────────────────────────────────────────────────────

describe('generatePromptSuggestions', () => {
  it('returns the starter fork for a user the Cat knows nothing about', async () => {
    expect(await generatePromptSuggestions('u-empty', makeContext())).toEqual(STARTER_PROMPTS);
  });

  it('degrades to deterministic gaps when the platform LLM is unavailable', async () => {
    const ctx = makeContext({
      profile: PROFILE,
      entities: [makeEntity('product', 'Handmade Candles')],
    });
    const out = await generatePromptSuggestions('u-nollm', ctx);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].reason).toBeTruthy();
    expect(out[0].prompt.toLowerCase()).toContain('paid');
  });

  it('returns at most four prompts', async () => {
    const ctx = makeContext({
      profile: { name: 'Alice', username: 'alice' },
      entities: [
        makeEntity('product', 'A', { status: 'draft' }),
        makeEntity('product', 'B', { description: null }),
        makeEntity('service', 'C', { price_btc: 0 }),
        makeEntity('cause', 'D'),
      ],
    });
    expect((await generatePromptSuggestions('u-many', ctx)).length).toBeLessThanOrEqual(4);
  });

  it('marks exactly one recommendation — the rest are unweighted alternatives', async () => {
    const ctx = makeContext({
      profile: { name: 'Alice', username: 'alice' },
      entities: [makeEntity('product', 'Handmade Candles', { status: 'draft' })],
    });
    const out = await generatePromptSuggestions('u-onelead', ctx);
    expect(out[0].reason).toBeTruthy();
    expect(out.slice(1).every(s => s.reason === undefined)).toBe(true);
  });

  it('never repeats the same prompt', async () => {
    const ctx = makeContext({
      profile: PROFILE,
      entities: [makeEntity('product', 'Widget A'), makeEntity('product', 'Widget B')],
    });
    const out = await generatePromptSuggestions('u-dupes', ctx);
    expect(new Set(out.map(s => s.prompt)).size).toBe(out.length);
  });

  it('uses the LLM phrasing when it is grounded in the user’s own data', async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        recommended: {
          prompt: 'What is missing before I publish "Handmade Candles"?',
          reason: '"Handmade Candles" is a draft and earns nothing while hidden.',
        },
        alternatives: ['Who would buy my candles?', 'Help me price my candles'],
      })
    );
    const ctx = makeContext({
      profile: PROFILE,
      wallets: [makeWallet()],
      entities: [makeEntity('product', 'Handmade Candles', { status: 'draft' })],
    });
    const out = await generatePromptSuggestions('u-grounded', ctx);
    expect(out[0].prompt).toContain('Handmade Candles');
    expect(out.map(s => s.prompt)).toContain('Who would buy my candles?');
  });

  it('discards an LLM recommendation that names nothing the user has', async () => {
    mockedCall.mockResolvedValue(
      JSON.stringify({
        recommended: {
          prompt: 'Help me market my haircuts',
          reason: 'Your barbershop needs customers.',
        },
        alternatives: [],
      })
    );
    const ctx = makeContext({
      profile: PROFILE,
      wallets: [makeWallet()],
      entities: [makeEntity('product', 'Handmade Candles', { status: 'draft' })],
    });
    const out = await generatePromptSuggestions('u-hallucinated', ctx);
    expect(out[0].prompt).not.toContain('haircuts');
    expect(out[0].prompt).toContain('Handmade Candles');
  });

  it('regenerates when the user’s state changes, and only then', async () => {
    const draft = makeEntity('product', 'Handmade Candles', { status: 'draft' });
    const ctx = makeContext({ profile: PROFILE, wallets: [makeWallet()], entities: [draft] });

    const first = await generatePromptSuggestions('u-cache', ctx);
    const cached = await generatePromptSuggestions('u-cache', ctx);
    expect(cached).toBe(first);
    expect(mockedCall).toHaveBeenCalledTimes(1);

    // Publishing the draft is a different reality — the answer must be recomputed.
    const published = makeContext({
      profile: PROFILE,
      wallets: [makeWallet()],
      entities: [{ ...draft, status: 'active' }],
    });
    const after = await generatePromptSuggestions('u-cache', published);
    expect(mockedCall).toHaveBeenCalledTimes(2);
    expect(after[0].prompt).not.toEqual(first[0].prompt);
  });
});
