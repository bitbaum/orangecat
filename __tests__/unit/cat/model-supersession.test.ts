/**
 * The half of model rot the rot check could not see.
 *
 * `checkModelRot` asks "is anything we pin now MISSING from the vendor's
 * catalogue" — a dead-pointer check. Claude Fable 5.1 shipped while we pinned
 * Fable 5; Fable 5 kept being listed and kept answering, so `missing` stayed
 * empty and nothing fired. The catalogue sat a version behind with every
 * signal green, and it was a human reading a dropdown who noticed.
 *
 * A check that only detects death cannot detect age. These pin the second
 * direction — and, just as importantly, pin that it stays QUIET, because the
 * failure mode of a version checker is noise.
 */

import { findSupersededPins } from '@/services/cat/provider-catalog';
import { AI_MODEL_REGISTRY } from '@/config/ai-models';

const verdict = (provider: string, present: string[], live: string[] | null) => ({
  provider,
  live,
  present,
  missing: [] as string[],
});

describe('spotting a newer version', () => {
  it('flags Fable 5 once Fable 5.1 is listed — the case that got through', () => {
    const found = findSupersededPins([
      verdict(
        'openrouter',
        ['anthropic/claude-fable-5'],
        ['anthropic/claude-fable-5', 'anthropic/claude-fable-5.1']
      ),
    ]);
    expect(found).toEqual([
      {
        provider: 'openrouter',
        pinned: 'anthropic/claude-fable-5',
        successor: 'anthropic/claude-fable-5.1',
      },
    ]);
  });

  it('handles both separators — 4.8 → 5, and 5 → 5-1', () => {
    const dotted = findSupersededPins([
      verdict('openrouter', ['claude-opus-4.8'], ['claude-opus-4.8', 'claude-opus-5']),
    ]);
    expect(dotted[0]?.successor).toBe('claude-opus-5');

    const dashed = findSupersededPins([
      verdict('anthropic', ['claude-fable-5'], ['claude-fable-5', 'claude-fable-5-1']),
    ]);
    expect(dashed[0]?.successor).toBe('claude-fable-5-1');
  });

  it('reports the NEWEST successor, not merely the first it finds', () => {
    const found = findSupersededPins([
      verdict(
        'anthropic',
        ['claude-opus-4.6'],
        ['claude-opus-4.6', 'claude-opus-4.7', 'claude-opus-4.8', 'claude-opus-5']
      ),
    ]);
    expect(found[0]?.successor).toBe('claude-opus-5');
  });
});

describe('staying quiet — a checker that cries wolf gets muted', () => {
  it('does not treat a bigger parameter count as a newer version', () => {
    // 120b is not "newer" than 20b; it is a different model at a different size.
    expect(
      findSupersededPins([
        verdict('groq', ['openai/gpt-oss-20b'], ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']),
      ])
    ).toEqual([]);
  });

  it('ignores ids with no parseable version at all', () => {
    expect(
      findSupersededPins([
        verdict(
          'openrouter',
          ['nvidia/nemotron-3-super-120b-a12b:free'],
          ['nvidia/nemotron-3-super-120b-a12b:free', 'meta/llama-guard']
        ),
      ])
    ).toEqual([]);
  });

  it('never reports a pin as superseding itself', () => {
    expect(
      findSupersededPins([verdict('anthropic', ['claude-opus-5'], ['claude-opus-5'])])
    ).toEqual([]);
  });

  it('does not cross model families', () => {
    expect(
      findSupersededPins([
        verdict('anthropic', ['claude-sonnet-5'], ['claude-sonnet-5', 'claude-opus-9']),
      ])
    ).toEqual([]);
  });

  it('says nothing when the catalogue could not be read — unknown is not up to date', () => {
    expect(findSupersededPins([verdict('groq', ['claude-fable-5'], null)])).toEqual([]);
  });

  it('is not confused by a :free suffix on one side only', () => {
    const found = findSupersededPins([
      verdict('openrouter', ['x/model-5:free'], ['x/model-5:free', 'x/model-6']),
    ]);
    expect(found[0]?.successor).toBe('x/model-6');
  });
});

describe('the registry itself', () => {
  it('carries Claude Fable 5.1, which is what started this', () => {
    expect(AI_MODEL_REGISTRY['anthropic/claude-fable-5.1']).toBeDefined();
    expect(AI_MODEL_REGISTRY['anthropic/claude-fable-5.1'].name).toBe('Claude Fable 5.1');
  });

  it('keeps Fable 5 — it is still served, so removing it would break selections', () => {
    expect(AI_MODEL_REGISTRY['anthropic/claude-fable-5']).toBeDefined();
  });
});
