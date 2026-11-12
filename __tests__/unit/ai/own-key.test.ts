import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickOwnKey, directKeyService } from '@/services/ai/own-key';
import { PROVIDER_BASE_URLS, PROVIDER_RUNTIME } from '@/config/ai-provider-runtime';
import { SHARED_POOL_DOWN_MESSAGE } from '@/services/ai/chain-failure-summary';

/**
 * A bot turn runs on the person's own key, whichever provider it is from.
 *
 * It read one key only, an OpenRouter key marked primary, while Settings → AI
 * takes keys for seven providers. The sentence a failed send shows ("add your
 * own API key … your bots then answer on it") is only true if this holds.
 */
describe("the person's own key for a bot turn", () => {
  const key = (provider: string, k = `key-of-${provider}`) => ({ provider, key: k });

  it('takes the first usable key in the order the person saved them', () => {
    expect(pickOwnKey([key('xai'), key('openrouter')])).toEqual(key('xai'));
    expect(pickOwnKey([key('openrouter'), key('xai')])).toEqual(key('openrouter'));
  });

  it('uses a key of every provider the settings page offers', () => {
    for (const provider of ['openrouter', 'groq', ...Object.keys(PROVIDER_RUNTIME)]) {
      expect(pickOwnKey([key(provider)])?.provider, provider).toBe(provider);
    }
  });

  it('skips a provider this app cannot call, and an empty key', () => {
    expect(pickOwnKey([key('made-up-vendor'), key('groq')])).toEqual(key('groq'));
    expect(pickOwnKey([key('xai', ''), key('openai')])).toEqual(key('openai'));
    expect(pickOwnKey([key('made-up-vendor')])).toBeNull();
    expect(pickOwnKey([])).toBeNull();
  });

  it('calls each provider at its own address with its own default model', () => {
    const xai = directKeyService(key('xai'));
    expect(xai?.model).toBe(PROVIDER_RUNTIME.xai.defaultModel);
    const groq = directKeyService(key('groq'));
    expect(groq?.model).toBeTruthy();
    expect(PROVIDER_BASE_URLS.groq).toMatch(/groq\.com/);
    // OpenRouter keeps its own routed client; an unknown vendor has none.
    expect(directKeyService(key('openrouter'))).toBeNull();
    expect(directKeyService(key('made-up-vendor'))).toBeNull();
  });

  it('is what the turn reads, so the sentence a failed send shows is true', () => {
    const turn = readFileSync('src/services/ai/sendMessage.ts', 'utf8');
    expect(turn).toMatch(/pickOwnKey\(await keyService\.listDecryptedKeysOrdered\(userId\)\)/);
    expect(turn).not.toMatch(/getDecryptedKey\(userId, 'openrouter'\)/);
    expect(turn).toMatch(/const hasByok = !!ownKey;/);
    expect(turn.match(/directKey,/g)?.length).toBe(2);
    const reply = readFileSync('src/services/ai/sendMessage-internals.ts', 'utf8');
    expect(reply).toMatch(/params\.directKey \? directKeyService\(params\.directKey\) : null/);
    expect(SHARED_POOL_DOWN_MESSAGE).toMatch(/your own API key in Settings → AI/);
  });
});
