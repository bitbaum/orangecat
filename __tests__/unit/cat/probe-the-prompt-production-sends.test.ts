/**
 * A health probe must measure the payload production actually sends.
 *
 * `groqCanServeCatPrompt()` called `buildCatSystemPrompt({})` and added the
 * few-shot block. Both defaults are wrong for Groq, and together they made the
 * check fail on every run — it drove `catCanAnswer`, so the nightly cron raised
 * CAT_CANNOT_ANSWER on a day when Cat could answer perfectly well.
 *
 * Pins RELATIONSHIPS (which configuration fits) rather than token constants.
 */
import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import { getCatFewShotExamplesText } from '@/services/cat/few-shot-examples';
import { estimateMessagesTokens, getGroqTpmLimit } from '@/services/ai/groq-capacity';
import { GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq-models';
import { groqCanServeCatPrompt } from '@/services/cat/health-probes';

const MODEL = 'openai/gpt-oss-20b';
const tokens = (s: string) => estimateMessagesTokens([{ content: s }]);

/** Exactly what chat-orchestrator computes for a platform Groq turn. */
const PRODUCTION_BUDGET = getGroqTpmLimit(MODEL) - GROQ_CHAT_MAX_TOKENS - 150;

const baseTools = () =>
  buildCatSystemPrompt({ actionsVia: 'tools', turnDescriptor: 'how do I fund a solar project?' });

describe('the Groq probe measures what production sends', () => {
  it('says Groq CAN serve a real Cat turn', () => {
    // The regression this file exists for. False here means a nightly
    // CAT_CANNOT_ANSWER alert on a working system.
    expect(groqCanServeCatPrompt()).toBe(true);
  });

  it('the base prompt production sends fits the production budget', () => {
    expect(tokens(baseTools())).toBeLessThanOrEqual(PRODUCTION_BUDGET);
  });

  it('the first-message turn — the largest real one — still fits', () => {
    const first = buildCatSystemPrompt({
      actionsVia: 'tools',
      turnDescriptor: 'first-message hello',
    });
    expect(tokens(first)).toBeLessThanOrEqual(PRODUCTION_BUDGET);
  });

  it('prose-with-no-selection does NOT fit, which is why the default was wrong', () => {
    // If this ever starts fitting, the probe's old default stopped being a bug
    // and this whole file can be reconsidered — but silently, it must not.
    expect(tokens(buildCatSystemPrompt({}))).toBeGreaterThan(PRODUCTION_BUDGET);
  });

  it('few-shot is optional: it does not fit alongside the base, and is trimmed', () => {
    // Including it in the probe is what tipped a fitting prompt over the edge.
    const withFewShot = tokens(baseTools()) + tokens(getCatFewShotExamplesText());
    expect(withFewShot).toBeGreaterThan(PRODUCTION_BUDGET);
    expect(tokens(baseTools())).toBeLessThanOrEqual(PRODUCTION_BUDGET);
  });
});
