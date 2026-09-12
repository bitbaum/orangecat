/**
 * The platform chain is what a user with no key of their own gets. Every step
 * in it must offer a model OrangeCat's own paywall will not bill.
 *
 * It did not. `buildPlatformProviders` gave its Groq step `DEFAULT_GROQ_MODEL`
 * — `openai/gpt-oss-120b`, which the registry tiers as `economy`, so
 * `isPlatformMeteredModel()` bills it. A free user's request therefore hit the
 * FIRST link of the chain, was refused by our own paywall with 402
 * INSUFFICIENT_CREDITS, and fell through to OpenRouter. Measured on production,
 * 30 days: 49 of 55 assistant messages came from OpenRouter, ONE from Groq.
 *
 * That mattered beyond one dead link. OrangeCat holds its OWN Groq key, while
 * its OpenRouter key is shared by seven apps on the box — so the chain was
 * skipping the dedicated capacity and crowding onto the shared 50-requests-a-day
 * pool, which is why the nightly eval kept finding it empty four hours after
 * midnight.
 *
 * A metered model in the free chain is silent: the step just always fails over.
 * This gate makes it loud.
 */
import { isPlatformMeteredModel } from '@/services/cat/credit-metering';
import { getModelMetadata } from '@/config/ai-models';
import { PLATFORM_GROQ_MODEL } from '@/services/ai/groq-models';

const realEnv = { ...process.env };
afterEach(() => {
  process.env = { ...realEnv };
});

describe('every step the platform offers a free user is free', () => {
  it('offers Groq a model the paywall will not bill', async () => {
    // The bug, directly: a metered default here is a step that can only 402.
    expect(isPlatformMeteredModel(PLATFORM_GROQ_MODEL)).toBe(false);
    expect(getModelMetadata(PLATFORM_GROQ_MODEL)?.isFree).toBe(true);
  });

  it('is not the model it used to be', () => {
    // gpt-oss-120b is `economy`, not free. Pinned so a well-meaning upgrade to
    // "the most capable Groq model" cannot silently kill the step again.
    expect(isPlatformMeteredModel('openai/gpt-oss-120b')).toBe(true);
    expect(PLATFORM_GROQ_MODEL).not.toBe('openai/gpt-oss-120b');
  });

  it('holds for EVERY step the chain builds, not just Groq', async () => {
    // The same defect could sit in the Together or Ollama step; nothing was
    // checking. A local Ollama model is unknown to the registry, which reads as
    // unmetered — correct, since nothing can bill a model on the user's own box.
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.OPENROUTER_API_KEY = 'or-key';
    process.env.TOGETHER_API_KEY = 'together-key';
    process.env.PLATFORM_OLLAMA_URL = 'http://127.0.0.1:11434/v1';

    const { buildPlatformProviders } = await import('@/services/ai/platform-providers');
    const steps = buildPlatformProviders('hello');
    expect(steps.length).toBeGreaterThan(1);

    const billable = steps
      .filter(s => isPlatformMeteredModel(s.defaultModel))
      .map(s => `${s.providerId}:${s.defaultModel}`);

    expect(
      billable,
      `these platform steps offer a model our own paywall bills, so they can only 402: ${billable.join(', ')}`
    ).toEqual([]);
  });

  it('leaves the BYOK Groq model alone — they are paying for it', async () => {
    // A user on their own Groq key faces no paywall, so they should keep the
    // capable model. The two defaults are deliberately different.
    const { DEFAULT_GROQ_MODEL } = await import('@/services/ai/groq-models');
    expect(DEFAULT_GROQ_MODEL).toBe('openai/gpt-oss-120b');
    expect(PLATFORM_GROQ_MODEL).not.toBe(DEFAULT_GROQ_MODEL);
  });

  it('serves a model that can still drive the tool loop', async () => {
    // A free step that cannot call tools would trade one silent failure for
    // another: Cat would answer but never act.
    expect(getModelMetadata(PLATFORM_GROQ_MODEL)?.capabilities).toContain('function_calling');
  });
});
