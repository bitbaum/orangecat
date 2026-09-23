/**
 * One catalogue check, and its model list is DERIVED.
 *
 * "Has the vendor retired a model we pin" was answered twice in this repo —
 * `probeFreeModelCatalog` for OpenRouter, `probeGroqModelCatalog` for Groq —
 * each carrying its own copy of the three-state null handling, and a third
 * provider would have needed a third copy. `@bitbaum/ai-kit` already had the
 * check, written after four of nine pinned ids in the shared chain turned out
 * to be gone and a consumer was silently failing for eight days.
 *
 * The risk in adopting it is subtle and worth a test: describing the chain
 * means writing model ids somewhere, and a hand-written list of ids is exactly
 * the thing being checked for. So the description reads from the config
 * OrangeCat actually serves from, and this pins that.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { orangecatChain } from '@/services/cat/provider-catalog';
import { getFreeModels, getModelMetadata } from '@/config/ai-models';
import { CONFIGURED_GROQ_MODEL_IDS } from '@/services/ai/groq-models';
import { servingChain } from '@/services/cat/provider-catalog';

describe('the chain description is read, not written', () => {
  const chain = orangecatChain();
  const byId = (id: string) => chain.find(p => p.id === id)!;

  it('watches every Groq id the config offers', () => {
    // Order is not the property — a rot check asks "does the vendor still list
    // this", which is membership. It changed when the chain gained a single
    // definition: the watched list now LEADS with the ids the platform actually
    // serves, then adds the ones only a BYOK user can select.
    expect(new Set(byId('groq').models)).toEqual(new Set(CONFIGURED_GROQ_MODEL_IDS));
  });

  it('watches a SUPERSET of what it serves, for every vendor', () => {
    // The invariant that replaced two hand-kept lists. `orangecatChain()` is
    // built FROM `servingChain()`, so an id that gets dialled cannot go
    // unwatched — which is exactly how Together's pinned llama-3.3 id sat in
    // the serving chain and in no rot check at all.
    const watched = orangecatChain();
    for (const serving of servingChain()) {
      const row = watched.find(p => p.id === serving.id);
      expect(row, `${serving.id} is served but not watched`).toBeDefined();
      for (const model of serving.models) {
        expect(row!.models, `${serving.id}/${model} is dialled but unwatched`).toContain(model);
      }
    }
  });

  it('watches Together, which no rot check covered before', () => {
    const together = orangecatChain().find(p => p.id === 'together');
    expect(together, 'together missing from the watched chain').toBeDefined();
    expect(together!.models.length).toBeGreaterThan(0);
  });

  it('takes its OpenRouter ids from the free models in the registry', () => {
    // No message passed, so the pool keeps registry order — all a rot check
    // needs. A real turn reorders it by what fits; see servingChain(message).
    expect(byId('openrouter').models).toEqual(getFreeModels().map(m => m.id));
    // And there is at least one, or the check would pass by checking nothing.
    expect(byId('openrouter').models.length).toBeGreaterThan(0);
  });

  it('names the key each provider actually reads', () => {
    // A wrong keyEnv makes the catalogue unreadable, which reports as "unknown"
    // — the quietest possible way for this check to stop working.
    expect(byId('groq').keyEnv).toBe('GROQ_API_KEY');
    expect(byId('openrouter').keyEnv).toBe('OPENROUTER_API_KEY');
  });

  it('points at the same base urls the app calls', () => {
    expect(byId('groq').baseUrl).toContain('api.groq.com');
    expect(byId('openrouter').baseUrl).toContain('openrouter.ai');
  });
});

describe('the health probe asks for a model the chain serves', () => {
  // This probed `llama-3.1-8b-instant` long after Groq withdrew the whole
  // llama-3.x family — groq-models.ts names that retirement in its own
  // comments. So the Groq health status, and `catCanAnswer` derived from it,
  // came from asking for a decommissioned model. The OpenRouter probe directly
  // below it carries a comment warning about exactly this drift: the fix was
  // applied there and not here.
  const src = readFileSync(join(__dirname, '../../../src/services/cat/health-probes.ts'), 'utf8');

  it('probes Groq with the model the platform actually offers', () => {
    expect(src).toContain('PLATFORM_GROQ_MODEL');
    expect(src).not.toContain("'llama-3.1-8b-instant'");
  });

  it('pins no literal model id in either provider probe', () => {
    // A literal here is the drift itself: it keeps "passing" while chat 404s,
    // and keeps "failing" after the registry is fixed.
    const from = src.indexOf('export function probeGroq');
    const to = src.indexOf('Does Groq', from);
    const probes = src.slice(from, to);
    expect(probes).toContain('PLATFORM_GROQ_MODEL');
    expect(probes).toContain('DEFAULT_FREE_MODEL_ID');
    // No quoted model-looking literal passed as the 4th probeProvider argument.
    expect(probes).not.toMatch(/,\s*'[a-z0-9][a-z0-9._\/-]{4,}'\s*\n\s*\)/);
  });
});

describe('a model the vendor no longer lists is not offered', () => {
  // Found by the health check on its FIRST run, then confirmed against
  // OpenRouter's live catalogue (445 ids) on 2026-09-13:
  // `openai/gpt-oss-20b:free` and `nvidia/nemotron-nano-9b-v2:free` are gone.
  // Until then the picker offered both, and choosing either answered 404.
  it('keeps unavailable models out of the free list', () => {
    const offered = getFreeModels().map(m => m.id);
    for (const retired of ['openai/gpt-oss-20b:free', 'nvidia/nemotron-nano-9b-v2:free']) {
      expect(offered, retired).not.toContain(retired);
    }
    expect(offered.length, 'something must still be offered').toBeGreaterThan(0);
  });

  it('keeps the metadata the Groq link depends on', () => {
    // Retired from OpenRouter, NOT deleted: Groq still serves the unsuffixed id
    // and PLATFORM_GROQ_MODEL resolves here for its tier. Deleting it would make
    // the platform's Groq model unknown to the registry — and an unknown model
    // is un-metered by accident rather than by decision.
    const meta = getModelMetadata('openai/gpt-oss-20b');
    expect(meta?.isFree).toBe(true);
    expect(meta?.isAvailable).toBe(false);
  });

  it('still offers the model production actually runs on', () => {
    // nvidia/nemotron-3-super-120b-a12b:free served 49 of 55 assistant messages
    // in 30 days. Confirmed LIVE in the same catalogue read.
    expect(getFreeModels().map(m => m.id)).toContain('nvidia/nemotron-3-super-120b-a12b:free');
  });
});
