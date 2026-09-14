/**
 * One schema, two shapes: a vendor key needs a key; your own endpoint needs
 * a URL and may have no key at all.
 */
import { addKeySchema } from '@/lib/validation/byok';
import { CUSTOM_PROVIDER_ID, WIRED_PROVIDER_IDS } from '@/data/aiProviders';

describe('addKeySchema', () => {
  it('accepts every wired provider id and nothing else', () => {
    for (const provider of WIRED_PROVIDER_IDS) {
      const body =
        provider === CUSTOM_PROVIDER_ID
          ? { provider, baseUrl: 'https://x.example/v1' }
          : { provider, apiKey: 'k'.repeat(20) };
      expect(addKeySchema.safeParse(body).success).toBe(true);
    }
    expect(addKeySchema.safeParse({ provider: 'anthropic', apiKey: 'k'.repeat(20) }).success).toBe(
      false
    );
  });

  it('a vendor key must be at least 10 characters', () => {
    const out = addKeySchema.safeParse({ provider: 'groq', apiKey: 'short' });
    expect(out.success).toBe(false);
  });

  it('your own endpoint needs a URL, and the key may be empty', () => {
    expect(addKeySchema.safeParse({ provider: CUSTOM_PROVIDER_ID }).success).toBe(false);
    expect(
      addKeySchema.safeParse({ provider: CUSTOM_PROVIDER_ID, baseUrl: 'ftp://x/v1' }).success
    ).toBe(false);
    const ok = addKeySchema.safeParse({
      provider: CUSTOM_PROVIDER_ID,
      baseUrl: ' https://models.example.org/v1 ',
      defaultModel: 'my-model',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.apiKey).toBe('');
      expect(ok.data.baseUrl).toBe('https://models.example.org/v1');
    }
  });
});
