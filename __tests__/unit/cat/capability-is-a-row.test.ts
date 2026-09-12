/**
 * A capability is a row, not a branch — ADR-0008 D3.
 *
 * What this replaces is the global flag. The repo has four
 * (`FEATURES.voiceInput`, `CAT_CREDITS_LIVE`, `SECTION_SELECTION_ENABLED`,
 * `CatAction.enabled`) plus a fifth, sneakier one: an env var standing in for
 * "this works". Each is on or off for EVERYBODY, so giving a capability to the
 * users who have already paid for it means editing code.
 *
 * Three things this pins, in order of how much they would hurt to lose:
 *
 *  1. a denial says WHICH term failed — "your model cannot see" and "this
 *     costs money" are different sentences, and today's behaviour (silence)
 *     teaches neither
 *  2. the `tools` rule DELEGATES to the observation system instead of
 *     re-deciding, so there is still one answer to "can this model use tools"
 *  3. computer use is built and OFF: a row nobody can satisfy yet, rather than
 *     code that does not exist
 */
import { beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import {
  mayUseCapability,
  canUseCapability,
  offerablePlatformTools,
  CAPABILITY_RULES,
  AWAITING_CONSUMER,
  type CatCapability,
} from '@/services/cat/capability-gate';
import { recordToolAttempt, __resetObservationsForTest } from '@/services/cat/tool-capability';

const realEnv = { ...process.env };

beforeEach(() => {
  __resetObservationsForTest();
  process.env.SEARXNG_URL = 'http://127.0.0.1:8899';
});
afterEach(() => {
  process.env = { ...realEnv };
});

describe('a denial names the term that refused', () => {
  it('separates "your model cannot" from "this costs money"', () => {
    // The whole point of a reason. A user told only "no" cannot tell whether to
    // bring a better model or to pay for one.
    const noModel = mayUseCapability('computer_use', {
      modelId: 'some/text-only-model',
      access: 'credits',
      grants: ['computer_use'],
    });
    const noMoney = mayUseCapability('computer_use', {
      modelId: 'gpt-5.2',
      access: 'free',
      grants: ['computer_use'],
    });

    expect(noModel.allowed).toBe(false);
    expect(noMoney.allowed).toBe(false);
    expect(noModel.allowed === false && noModel.because).toBe('model');
    expect(noMoney.allowed === false && noMoney.because).toBe('entitlement');
  });

  it('says "unconfigured" when the platform cannot serve it at all', () => {
    // Not the user's fault and not their model's — nothing to fix on their end.
    delete process.env.SEARXNG_URL;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const v = mayUseCapability('web', { modelId: 'gpt-5.2' });
    expect(v.allowed).toBe(false);
    expect(v.allowed === false && v.because).toBe('unconfigured');
  });

  it('reads the environment at call time, not at import time', () => {
    // A module-level constant freezes the answer into the bundle, so setting a
    // key and restarting would not fix it.
    delete process.env.SEARXNG_URL;
    expect(canUseCapability('web', { modelId: 'gpt-5.2' })).toBe(false);
    process.env.SEARXNG_URL = 'http://127.0.0.1:8899';
    expect(canUseCapability('web', { modelId: 'gpt-5.2' })).toBe(true);
  });
});

describe('there is still ONE answer about tools', () => {
  it('delegates to what traffic proved, rather than re-deciding', () => {
    // If this rule read the registry instead, a model observed refusing tools
    // would be allowed here and refused in the loop — two answers to one
    // question, which is the bug ADR-0008 exists to end.
    const MODEL = 'some/uncatalogued-model';
    const KEY = 'sk-key';

    expect(canUseCapability('tools', { modelId: MODEL })).toBe(true);

    recordToolAttempt(MODEL, KEY, {
      status: 400,
      bodyText: '{"error":{"message":"This model does not support tool use"}}',
    });

    const after = mayUseCapability('tools', { modelId: MODEL, observedTools: 'none' });
    expect(after.allowed).toBe(false);
    expect(after.allowed === false && after.because).toBe('model');
  });

  it('stays optimistic about a model nobody has catalogued', () => {
    // A registry says where to start, never where to stop.
    expect(canUseCapability('tools', { modelId: 'nobody/has-heard-of-this' })).toBe(true);
  });
});

describe('computer use is built and off', () => {
  it('is refused for want of a grant, not for want of code', () => {
    // The row exists; nothing issues the grant yet. Switching it on is a
    // decision, not an implementation.
    const v = mayUseCapability('computer_use', { modelId: 'gpt-5.2', access: 'credits' });
    expect(v.allowed).toBe(false);
    expect(v.allowed === false && v.because).toBe('grant');
  });

  it('needs BOTH sight and tools even once granted', () => {
    // A keyboard without eyes cannot check what it just did.
    expect(CAPABILITY_RULES.computer_use.needsGrant).toBe(true);
    const v = mayUseCapability('computer_use', {
      modelId: 'some/text-only-model',
      access: 'byok',
      grants: ['computer_use'],
    });
    expect(v.allowed === false && v.because).toBe('model');
  });

  it('is never reachable on the free tier', () => {
    for (const grants of [[], ['computer_use'] as CatCapability[]]) {
      expect(canUseCapability('computer_use', { modelId: 'gpt-5.2', access: 'free', grants })).toBe(
        false
      );
    }
  });
});

describe('the default is the restrictive one', () => {
  it('treats a missing access source as free', () => {
    // An omitted field must never be the permissive case: a call site that
    // forgets to pass the user would otherwise hand out the paid capability.
    const v = mayUseCapability('computer_use', { modelId: 'gpt-5.2', grants: ['computer_use'] });
    expect(v.allowed === false && v.because).toBe('entitlement');
  });

  it('treats a missing model as incapable', () => {
    expect(canUseCapability('vision', { modelId: null })).toBe(false);
    expect(canUseCapability('vision', { modelId: undefined })).toBe(false);
  });
});

describe('a tool that cannot work is not offered', () => {
  const tools = [
    { function: { name: 'search_platform' } },
    { function: { name: 'web_search' } },
    { function: { name: 'read_page' } },
    { function: { name: 'query_my_data' } },
  ];

  it('keeps the web tools when a backend is configured', () => {
    const out = offerablePlatformTools(tools, { modelId: 'gpt-5.2' });
    expect(out.map(t => t.function.name)).toEqual(tools.map(t => t.function.name));
  });

  it('drops ONLY the web tools when none is', () => {
    // The rule the action tools already followed: offering a tool that must
    // fail teaches the model to propose it, and every lookup came back
    // "could not look" — which the user reads as Cat being useless, not as
    // a deployment missing a key.
    delete process.env.SEARXNG_URL;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.TAVILY_API_KEY;

    const out = offerablePlatformTools(tools, { modelId: 'gpt-5.2' }).map(t => t.function.name);
    expect(out).toEqual(['search_platform', 'query_my_data']);
    expect(out).not.toContain('web_search');
    expect(out).not.toContain('read_page');
  });

  it('does not mutate the definitions it was handed', () => {
    // PLATFORM_TOOL_DEFINITION is module-level and shared by every request.
    const before = tools.length;
    offerablePlatformTools(tools, { modelId: 'gpt-5.2' });
    expect(tools).toHaveLength(before);
  });
});

describe('every capability is a row, and the rows are the vocabulary', () => {
  it('has a rule for each declared capability', () => {
    // A capability with no row would fall through to "allowed" silently.
    const declared: CatCapability[] = ['tools', 'web', 'vision', 'computer_use'];
    for (const cap of declared) {
      expect(CAPABILITY_RULES[cap], cap).toBeDefined();
    }
    expect(Object.keys(CAPABILITY_RULES).sort()).toEqual([...declared].sort());
  });

  it('leaves web free for everyone on purpose', () => {
    // Looking things up is how Cat stops inventing figures. Rationing it by
    // tier would ration honesty, so this row has no access term — deliberately.
    expect(CAPABILITY_RULES.web.access).toBeUndefined();
    expect(canUseCapability('web', { modelId: 'gpt-5.2', access: 'free' })).toBe(true);
  });
});

describe('a row with no consumer says so', () => {
  // A row nothing consults is a claim that the gate governs something it does
  // not. Enforced in BOTH directions, because each is a real drift: a new row
  // with no caller and no declaration would look gated and not be, and a stale
  // declaration would hide that a capability IS now gated.
  const consumed = (cap: string): boolean => {
    // Whether anything actually asks the gate about this capability.
    const out = execSync(`grep -rEo "(may|can)UseCapability\\('${cap}'" src/ || true`, {
      encoding: 'utf8',
    });
    return out.trim().length > 0;
  };

  const all = Object.keys(CAPABILITY_RULES) as CatCapability[];

  it('declares every capability nothing asks about', () => {
    const undeclared = all.filter(c => !consumed(c) && !AWAITING_CONSUMER[c]);
    expect(
      undeclared,
      `these rows look gated but nothing consults them — add a caller, or an AWAITING_CONSUMER reason: ${undeclared.join(', ')}`
    ).toEqual([]);
  });

  it('carries no stale declaration for a capability that is now consulted', () => {
    const stale = (Object.keys(AWAITING_CONSUMER) as CatCapability[]).filter(c => consumed(c));
    expect(
      stale,
      `these are consulted now, so remove them from AWAITING_CONSUMER: ${stale.join(', ')}`
    ).toEqual([]);
  });

  it('gives a reason, not an empty placeholder', () => {
    for (const [cap, reason] of Object.entries(AWAITING_CONSUMER)) {
      expect(reason, cap).toBeTruthy();
      expect(reason!.length, cap).toBeGreaterThan(15);
    }
  });

  it('is web that is actually wired, and it still answers', () => {
    // The one live consumer, so the gate is not decoration.
    expect(AWAITING_CONSUMER.web).toBeUndefined();
    expect(canUseCapability('web', { modelId: 'gpt-5.2' })).toBe(true);
  });
});
