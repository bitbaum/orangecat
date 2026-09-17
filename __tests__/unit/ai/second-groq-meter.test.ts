/**
 * Two Groq links, because Groq rations PER MODEL.
 *
 * The usual rule in this codebase is that a same-vendor fallback is not one —
 * a second model at the same vendor draws on the same daily budget, so it is
 * already dead when that budget is spent. Groq measurably does NOT work that
 * way. Read from response headers on one key within the same minute,
 * 2026-09-13:
 *
 *     openai/gpt-oss-20b    591 / 1000 requests remaining   (what production runs)
 *     openai/gpt-oss-120b   999 / 1000
 *     qwen/qwen3.8-27b      999 / 1000
 *
 * Separate counters, and separate 8000-token minutes. So the second link draws
 * on a budget the first one cannot spend, which is a real fallback.
 *
 * It was chosen by probe rather than by spec sheet, and that mattered:
 * `groq/compound-mini` advertises 70000 TPM — nearly nine times the others —
 * and answers `tool calling is not supported with this model`. Cat drives a
 * tool loop, so all that headroom is unreachable. `qwen/qwen3.8-27b` returned a
 * native tool_call for a real function definition.
 */
import { buildPlatformProviders } from '@/services/ai/platform-providers';
import {
  PLATFORM_GROQ_MODEL,
  PLATFORM_GROQ_FALLBACK_MODEL,
  CONFIGURED_GROQ_MODEL_IDS,
} from '@/services/ai/groq-models';
import { GROQ_TPM_LIMIT_BY_MODEL } from '@/services/ai/groq-capacity';
import { isPlatformMeteredModel } from '@/services/cat/credit-metering';

const ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('the second Groq link is a second meter', () => {
  it('is a DIFFERENT model from the primary, or it is not a fallback', () => {
    // The entire value is the separate counter. Same id twice would add a
    // retry, not headroom.
    expect(PLATFORM_GROQ_FALLBACK_MODEL).not.toBe(PLATFORM_GROQ_MODEL);
  });

  it('puts both Groq models in the chain, primary first', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    const groq = buildPlatformProviders('hello').filter(p => p.providerId === 'groq');
    expect(groq.map(p => p.defaultModel)).toEqual([
      PLATFORM_GROQ_MODEL,
      PLATFORM_GROQ_FALLBACK_MODEL,
    ]);
  });

  it('collapses to one link when both ids are the same', async () => {
    // The documented way to disable the second link without a deploy. Driven
    // through a real re-import, because the consts are read at module load —
    // an earlier draft asserted an inline copy of the de-duplication rule,
    // which would have passed with the feature deleted.
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.PLATFORM_GROQ_FALLBACK_MODEL = PLATFORM_GROQ_MODEL;
    vi.resetModules();

    const { buildPlatformProviders: build } = await import(
      '@/services/ai/platform-providers'
    );
    const groq = build('hello').filter(p => p.providerId === 'groq');
    expect(groq.map(p => p.defaultModel)).toEqual([PLATFORM_GROQ_MODEL]);
  });

  it('adds no Groq links at all without a key', () => {
    delete process.env.GROQ_API_KEY;
    const groq = buildPlatformProviders('hello').filter(p => p.providerId === 'groq');
    expect(groq).toHaveLength(0);
  });

  it('keeps the fallback in the catalogue check, so its retirement is noticed', () => {
    // A model in the chain but outside the drift probe rots silently — the
    // failure that left two decommissioned Groq ids in place for weeks.
    expect(CONFIGURED_GROQ_MODEL_IDS).toContain(PLATFORM_GROQ_FALLBACK_MODEL);
  });

  it('knows the fallback uses its own token-per-minute window', () => {
    // Without an entry the pre-flight uses a GUESSED fallback limit, and a
    // wrong TPM number either wastes headroom or admits a guaranteed 413.
    expect(GROQ_TPM_LIMIT_BY_MODEL[PLATFORM_GROQ_FALLBACK_MODEL]).toBeGreaterThan(0);
  });

  it('never bills a user for the fallback', () => {
    // This chain exists for users with no key and no credits. A metered link
    // here can only 402 — the exact bug that made the whole free chain unusable
    // until it was found in production data.
    expect(isPlatformMeteredModel(PLATFORM_GROQ_FALLBACK_MODEL)).toBe(false);
    expect(isPlatformMeteredModel(PLATFORM_GROQ_MODEL)).toBe(false);
  });
});
