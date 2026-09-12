/**
 * More vendors is the only durable answer to "free AI that actually works".
 *
 * Every vendor retires models without notice, reclassifies a free model as
 * paid, and rations by a per-minute budget you discover by exceeding it — all
 * three have happened here. No amount of care with one vendor survives that.
 * INDEPENDENT BUCKETS do: several vendors, each with its own daily allowance,
 * so one being spent is a failover instead of an outage.
 *
 * Measured on 2026-09-12, with only Groq and OpenRouter wired: the Groq link
 * carries ONE prior exchange on a create-intent turn before its 8 000-token
 * per-minute budget is exceeded, and OpenRouter — the only other link — runs on
 * a key seven apps share. That is the fragility these entries address.
 *
 * The property that makes them safe to carry before the accounts exist is that
 * they are INERT WITHOUT A KEY, and that is what this pins. The model ids are
 * best-known rather than verified; they are watched by the catalogue check
 * rather than trusted, which is the whole design.
 */
import { beforeEach, afterEach } from 'vitest';
import { FREE_VENDORS, configuredFreeVendors, vendorModel } from '@/config/free-vendors';

const realEnv = { ...process.env };
beforeEach(() => {
  for (const v of FREE_VENDORS) {
    delete process.env[v.keyEnv];
    delete process.env[v.modelEnv];
  }
});
afterEach(() => {
  process.env = { ...realEnv };
});

describe('a vendor with no key does not exist', () => {
  it('contributes nothing until its key is set', () => {
    expect(configuredFreeVendors()).toEqual([]);
  });

  it('appears the moment a key lands, with no deploy', () => {
    process.env.CEREBRAS_API_KEY = 'sk-test';
    expect(configuredFreeVendors().map(v => v.id)).toEqual(['cerebras']);
  });

  it('treats whitespace as absent, not as configured', () => {
    // A key env set to "" or " " by a half-finished deploy would otherwise
    // build a link that 401s on every request.
    process.env.GOOGLE_AI_API_KEY = '   ';
    expect(configuredFreeVendors()).toEqual([]);
  });

  it('adds a chain LINK per configured vendor, and only those', async () => {
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.CEREBRAS_API_KEY = 'cerebras-key';
    const { buildPlatformProviders } = await import('@/services/ai/platform-providers');

    const ids = buildPlatformProviders('hello').map(p => p.providerId);
    expect(ids).toContain('cerebras');
    expect(ids).not.toContain('google');
    expect(ids).not.toContain('github');
  });
});

describe('a retired model needs an env var, not a release', () => {
  it('lets the model id be replaced at call time', () => {
    // The point: routing around a retirement should not wait for a deploy.
    const cerebras = FREE_VENDORS.find(v => v.id === 'cerebras')!;
    expect(vendorModel(cerebras)).toBe(cerebras.defaultModel);
    process.env[cerebras.modelEnv] = 'some-newer-model';
    expect(vendorModel(cerebras)).toBe('some-newer-model');
  });

  it('reads the override live, not at import', () => {
    // A value frozen at module load would need the redeploy it exists to avoid.
    const google = FREE_VENDORS.find(v => v.id === 'google')!;
    process.env[google.modelEnv] = 'first';
    expect(vendorModel(google)).toBe('first');
    process.env[google.modelEnv] = 'second';
    expect(vendorModel(google)).toBe('second');
  });
});

describe('every vendor is watched from its first run', () => {
  it('is included in the catalogue check, so bad ids surface immediately', async () => {
    // These ids are best-known, not verified. Carrying them is only honest
    // because the rot check reports the ones the vendor does not list.
    const { orangecatChain } = await import('@/services/cat/provider-catalog');
    const watched = orangecatChain().map(p => p.id);
    for (const v of FREE_VENDORS) {
      expect(watched, v.id).toContain(v.id);
    }
  });

  it('watches the id it would actually ask for, including the override', async () => {
    const github = FREE_VENDORS.find(v => v.id === 'github')!;
    process.env[github.modelEnv] = 'openai/some-other-model';
    const { orangecatChain } = await import('@/services/cat/provider-catalog');
    const entry = orangecatChain().find(p => p.id === 'github')!;
    expect(entry.models).toEqual(['openai/some-other-model']);
  });

  it('names the key env each vendor actually reads', () => {
    // A wrong keyEnv makes the vendor permanently unconfigured AND its
    // catalogue unreadable — two silences for one typo.
    for (const v of FREE_VENDORS) {
      expect(v.keyEnv, v.id).toMatch(/^[A-Z0-9_]+$/);
      expect(v.baseUrl, v.id).toMatch(/^https:\/\//);
      expect(v.baseUrl.endsWith('/'), `${v.id} baseUrl must not end in /`).toBe(false);
      expect(v.defaultModel.length, v.id).toBeGreaterThan(0);
    }
  });
});
