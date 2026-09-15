/**
 * Chain order is CAPACITY, not preference.
 *
 * OpenRouter's unpaid tier is 50 requests a day for the whole ACCOUNT, and one
 * OpenRouter key serves ten apps on this box — so OrangeCat's realistic share is
 * a handful of requests, spent early by whichever app asks first. Gemini's quota
 * is per PROJECT: the one pool this app does not share with anything.
 *
 * Measured on 2026-09-15, before this change, the built chain was:
 *
 *     1. groq        openai/gpt-oss-20b
 *     2. groq        qwen/qwen3.8-27b
 *     3. openrouter  nvidia/nemotron-3-super-120b-a12b:free
 *     4. openrouter  google/gemma-4-31b-it:free
 *     5. google      models/gemini-flash-latest      <- last
 *
 * So once Groq was spent, every message paid two near-certain 429s before
 * reaching a vendor that could answer — and more than two once free-pool
 * discovery has run, since that appends up to six more OpenRouter links.
 *
 * ai-kit's freeChain() already orders it `groq -> google -> openrouter`, and
 * Loki inherits that from the package. This pins OrangeCat's hand-rolled chain
 * to the same rule, because the two drifting apart is how one app quietly gets
 * a worse chain than the other.
 */
import { buildPlatformProviders } from '@/services/ai/platform-providers';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.GROQ_API_KEY = 'gsk_test';
  process.env.OPENROUTER_API_KEY = 'sk-or-test';
  process.env.GEMINI_API_KEY = 'gem-test';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('the scarcest pool is drained last', () => {
  it('puts every free vendor BEFORE the first OpenRouter link', () => {
    const links = buildPlatformProviders('how do I fund a solar project?');
    const firstOpenRouter = links.findIndex(p => p.providerId === 'openrouter');
    const lastFreeVendor = links.map(p => p.providerId).lastIndexOf('google');

    expect(firstOpenRouter, 'no OpenRouter link was built').toBeGreaterThan(-1);
    expect(lastFreeVendor, 'no free-vendor link was built').toBeGreaterThan(-1);
    expect(lastFreeVendor).toBeLessThan(firstOpenRouter);
  });

  it('still leads with Groq, which has the largest per-model pools', () => {
    const links = buildPlatformProviders('hello');
    expect(links[0]?.providerId).toBe('groq');
  });

  it('keeps OpenRouter in the chain rather than dropping it', () => {
    // Last is not the same as gone: its catalogue is the widest, and it is the
    // link that still works when a specific vendor has a bad day.
    const ids = buildPlatformProviders('hello').map(p => p.providerId);
    expect(ids).toContain('openrouter');
  });

  it('omits the free vendor entirely when its key is absent', () => {
    delete process.env.GEMINI_API_KEY;
    const ids = buildPlatformProviders('hello').map(p => p.providerId);
    expect(ids).not.toContain('google');
    expect(ids).toContain('openrouter');
  });
});
