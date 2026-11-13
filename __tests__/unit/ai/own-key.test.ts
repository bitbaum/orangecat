import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pickOwnKey, readOwnKey } from '@/services/ai/own-key';
import { directKeyService } from '@/services/ai/own-key-service';
import { WIRED_PROVIDER_IDS } from '@/data/aiProviders';
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
    // The settings form's own list: a provider added there without a client
    // here fails this test instead of sending a person back to the shared pool.
    expect(WIRED_PROVIDER_IDS.length).toBeGreaterThan(2);
    for (const provider of WIRED_PROVIDER_IDS) {
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
    // The host exactly: a pattern on a URL without anchors matches other hosts too.
    expect(new URL(PROVIDER_BASE_URLS.groq).hostname).toBe('api.groq.com');
    // OpenRouter keeps its own routed client; an unknown vendor has none.
    expect(directKeyService(key('openrouter'))).toBeNull();
    expect(directKeyService(key('made-up-vendor'))).toBeNull();
  });

  it('looks a key up without being able to reach a model', () => {
    // The routine's settings row reads the lookup on a page load.
    const lookup = readFileSync('src/services/ai/own-key.ts', 'utf8');
    expect(lookup).not.toMatch(/from '[^']*(openai-compat|openrouter|\/groq)'/);
  });

  it('is read once for every kind of bot turn', async () => {
    const keys = (list: Array<{ provider: string; key: string }>) => ({
      listDecryptedKeysOrdered: async () => list,
    });
    expect(await readOwnKey(keys([key('xai')]), 'u')).toEqual({
      hasByok: true,
      userKey: null,
      directKey: key('xai'),
    });
    expect(await readOwnKey(keys([key('openrouter')]), 'u')).toEqual({
      hasByok: true,
      userKey: 'key-of-openrouter',
      directKey: null,
    });
    expect(await readOwnKey(keys([]), 'u')).toEqual({
      hasByok: false,
      userKey: null,
      directKey: null,
    });
  });

  it('is what every bot path reads, so the sentence a failed send shows is true', () => {
    // The one-to-one turn, the group chat, the routine and its settings row.
    const paths = [
      'src/services/ai/sendMessage.ts',
      'src/services/companions/rooms/respond.ts',
      'src/services/companions/routines.ts',
      'src/app/api/ai-assistants/[id]/routine/route.ts',
    ];
    for (const path of paths) {
      const src = readFileSync(path, 'utf8');
      expect(src, path).toMatch(/readOwnKey\(/);
      expect(src, path).not.toMatch(/getDecryptedKey\(/);
    }
    const turn = readFileSync('src/services/ai/sendMessage.ts', 'utf8');
    // Both calls of the turn pass it on: the first reply and the work loop's steps.
    // And the check of a step against the owner's rules (companions/rules.ts) runs on it too.
    expect(turn.match(/^\s*directKey,$/gm)?.length).toBe(3);
    expect(readFileSync('src/services/companions/rooms/respond.ts', 'utf8')).toMatch(
      /userKey,\s*directKey,/
    );
    const reply = readFileSync('src/services/ai/sendMessage-internals.ts', 'utf8');
    expect(reply).toMatch(/params\.directKey \? directKeyService\(params\.directKey\) : null/);
    expect(SHARED_POOL_DOWN_MESSAGE).toMatch(/your own API key in Settings → AI/);
  });
});
