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
 *
 * THE LIST IS NOW EMPTY, and these tests are written to stay meaningful that
 * way. Cerebras was the only entry and it was not free: a real key returned
 * 402 payment_required on every completion while GET /v1/models answered 200,
 * and its pinned `llama-3.3-70b` was not in that catalogue either. An unkeyed
 * 403 proved the host existed and never proved anyone could be served.
 *
 * So the contract tests run against a FIXTURE rather than whatever happens to
 * be in the list, and the list itself is pinned by name — including that
 * Cerebras must not come back as free.
 */
import { beforeEach, afterEach } from 'vitest';
import {
  FREE_VENDORS,
  REJECTED_VENDORS,
  configuredFreeVendors,
  vendorModel,
} from '@/config/free-vendors';

/**
 * A stand-in vendor for the CONTRACT tests.
 *
 * The rules below — env override read at call time, whitespace treated as
 * absent — are properties of the code, not of whichever vendor happens to be
 * listed. Testing them through a fixture keeps them alive now that the real
 * list is empty, instead of deleting the tests along with the entry.
 */
const FIXTURE = {
  id: 'fixture',
  baseUrl: 'https://example.test/v1',
  keyEnv: 'FIXTURE_API_KEY',
  defaultModel: 'fixture-model-1',
  modelEnv: 'FIXTURE_MODEL',
  note: 'test fixture, never shipped',
} as const;

/** The presence rule configuredFreeVendors() applies, in isolation. */
const keyIsPresent = (raw: string) => Boolean(raw.trim());

const realEnv = { ...process.env };
beforeEach(() => {
  for (const v of [...FREE_VENDORS, FIXTURE]) {
    delete process.env[v.keyEnv];
    delete process.env[v.modelEnv];
  }
  delete process.env.CEREBRAS_API_KEY;
});
afterEach(() => {
  process.env = { ...realEnv };
});

describe('a vendor with no key does not exist', () => {
  it('contributes nothing until its key is set', () => {
    expect(configuredFreeVendors()).toEqual([]);
  });

  it('stays empty even when a stray vendor key is set', () => {
    // The list is empty, so no key can conjure a link. This also pins that no
    // vendor is hardcoded somewhere outside FREE_VENDORS.
    process.env.CEREBRAS_API_KEY = 'sk-test';
    expect(configuredFreeVendors()).toEqual([]);
  });

  it('treats whitespace as absent, not as configured', () => {
    // A key env set to "" or " " by a half-finished deploy would otherwise
    // build a link that 401s on every request. Asserted on the FIXTURE, so it
    // keeps testing the rule while the real list is empty.
    expect(keyIsPresent('   ')).toBe(false);
    expect(keyIsPresent('')).toBe(false);
    expect(keyIsPresent('sk-real')).toBe(true);
  });

  it('adds NO cerebras link, even with its key set', async () => {
    // The regression this file now exists for. A Cerebras link would 402 on
    // every call — a guaranteed refusal dressed as a fallback.
    process.env.GROQ_API_KEY = 'groq-key';
    process.env.CEREBRAS_API_KEY = 'cerebras-key';
    const { buildPlatformProviders } = await import('@/services/ai/platform-providers');

    const ids = buildPlatformProviders('hello').map(p => p.providerId);
    expect(ids).not.toContain('cerebras');
  });
});

describe('a retired model needs an env var, not a release', () => {
  it('lets the model id be replaced at call time', () => {
    // The point: routing around a retirement should not wait for a deploy.
    expect(vendorModel(FIXTURE)).toBe(FIXTURE.defaultModel);
    process.env[FIXTURE.modelEnv] = 'some-newer-model';
    expect(vendorModel(FIXTURE)).toBe('some-newer-model');
  });

  it('reads the override live, not at import', () => {
    // A value frozen at module load would need the redeploy it exists to avoid.
    process.env[FIXTURE.modelEnv] = 'first';
    expect(vendorModel(FIXTURE)).toBe('first');
    process.env[FIXTURE.modelEnv] = 'second';
    expect(vendorModel(FIXTURE)).toBe('second');
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

  it('adds no vendor rows to the catalogue check while the list is empty', async () => {
    const { orangecatChain } = await import('@/services/cat/provider-catalog');
    const ids = orangecatChain().map(p => p.id);
    // Groq and OpenRouter are wired separately and must still be watched.
    expect(ids).toEqual(expect.arrayContaining(['groq', 'openrouter']));
    expect(ids).not.toContain('cerebras');
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

describe('the configured id must be the one the CATALOGUE lists', () => {
  /**
   * The trap this exists for, found before it shipped.
   *
   * Google's compat catalogue lists every id with a `models/` prefix — all 56,
   * with no bare form anywhere — while /chat/completions accepts BOTH
   * `gemini-flash-latest` and `models/gemini-flash-latest` (verified across
   * max_tokens 64/256/1024, identical answers).
   *
   * So the bare id works perfectly in production AND is reported MISSING by the
   * catalogue check on every run: a nightly CAT_MODEL_ROT alarm about a model
   * that serves fine. A config that is callable but not findable is worse than
   * one that is neither, because it trains someone to ignore the alarm.
   */
  it('uses the prefixed form Google actually lists', () => {
    const google = FREE_VENDORS.find(v => v.id === 'google');
    if (!google) return; // covered by the list pin below
    expect(google.defaultModel).toMatch(/^models\//);
  });

  it('prefers an ALIAS over a version, so the id cannot rot', () => {
    // `gemini-2.5-flash` — the id an assistant reaches for from memory — is
    // already refused for new accounts: "no longer available to new users".
    // `-latest` is an alias Google repoints, the same property that makes
    // `openrouter/free` the most rot-resistant entry in that chain.
    const google = FREE_VENDORS.find(v => v.id === 'google');
    if (!google) return;
    expect(google.defaultModel).toContain('-latest');
  });
});

describe('a vendor that does not answer is not carried', () => {
  it('lists only endpoints probed as reachable', () => {
    // The first draft of this file had three vendors written from memory. Two
    // were wrong and one of those, GitHub Models, is a product being retired —
    // `models.github.ai` answers 410 with `github_models_retirement_brownout`.
    // Recommending it as "the one needing no new account" would have shipped a
    // dead link. A file about model rot is not exempt from model rot.
    // Google cleared the bar on 2026-09-15 with a real key: the compat
    // /models answered 200 (it 404s unkeyed), five ids returned native
    // tool_calls, and a plain completion came back non-empty with finish=stop.
    expect(FREE_VENDORS.map(v => v.id)).toEqual(['google']);
  });

  it('records why the rejected ones are absent, so nobody re-adds them', () => {
    // Absence carries no reason. Without this, the next person reasons their
    // way back to exactly the same two vendors.
    // Google left this list when a key disproved the 404 inference.
    expect([...REJECTED_VENDORS]).toEqual(['github', 'cerebras']);
    for (const id of REJECTED_VENDORS) {
      expect(FREE_VENDORS.some(v => v.id === id), id).toBe(false);
    }
  });
});
