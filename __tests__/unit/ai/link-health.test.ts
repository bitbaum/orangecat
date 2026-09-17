/**
 * Circuit breaker for the Cat provider chain — dead links are skipped for a
 * TTL, but pruning may NEVER empty a chain (retrying dead links beats
 * refusing to try, which is the "Cat is never unavailable" invariant).
 */
import {
  isLinkDown,
  markLinkDown,
  pruneDownLinks,
  resetLinkHealth,
} from '@/services/ai/link-health';

const CHAIN = [
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'openrouter', model: 'a:free' },
  { provider: 'openrouter', model: 'b:free' },
];

describe('link-health', () => {
  beforeEach(() => {
    resetLinkHealth();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks a link down and prunes it from the chain', () => {
    markLinkDown('groq', 'llama-3.3-70b-versatile');
    expect(isLinkDown('groq', 'llama-3.3-70b-versatile')).toBe(true);
    const pruned = pruneDownLinks(CHAIN, l => l);
    expect(pruned.map(l => l.provider)).toEqual(['openrouter', 'openrouter']);
  });

  it('expires the down-mark after the TTL', () => {
    markLinkDown('groq', 'llama-3.3-70b-versatile', 1000);
    vi.advanceTimersByTime(1001);
    expect(isLinkDown('groq', 'llama-3.3-70b-versatile')).toBe(false);
    expect(pruneDownLinks(CHAIN, l => l)).toHaveLength(3);
  });

  it('never prunes to an empty chain — all-down returns the original', () => {
    for (const l of CHAIN) {
      markLinkDown(l.provider, l.model);
    }
    expect(pruneDownLinks(CHAIN, l => l)).toEqual(CHAIN);
  });

  it('same model id under different providers is tracked separately', () => {
    markLinkDown('openrouter', 'a:free');
    expect(isLinkDown('together', 'a:free')).toBe(false);
  });
});
