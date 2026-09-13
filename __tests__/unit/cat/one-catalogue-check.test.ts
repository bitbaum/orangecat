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
import { getFreeModels } from '@/config/ai-models';
import { CONFIGURED_GROQ_MODEL_IDS } from '@/services/ai/groq-models';

describe('the chain description is read, not written', () => {
  const chain = orangecatChain();
  const byId = (id: string) => chain.find(p => p.id === id)!;

  it('takes its Groq ids from the Groq config', () => {
    expect(byId('groq').models).toEqual([...CONFIGURED_GROQ_MODEL_IDS]);
  });

  it('takes its OpenRouter ids from the free models in the registry', () => {
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

describe('the old per-provider probes are gone', () => {
  const src = readFileSync(
    join(__dirname, '../../../src/services/cat/health-probes.ts'),
    'utf8'
  );

  it('leaves no second implementation behind to drift', () => {
    // Adopting a shared check and leaving the copy in place is how two answers
    // to one question survive — the failure this whole adoption is about.
    expect(src).not.toContain('export async function probeFreeModelCatalog');
    expect(src).not.toContain('export async function probeGroqModelCatalog');
  });

  it('asks the shared checker instead', () => {
    expect(src).toContain('checkModelRot()');
  });

  it('still reports per provider, so the report shape is unchanged', () => {
    // Everything downstream — the diagnose route, the health action, the new
    // cron alert — reads missingFreeModels / missingGroqModels.
    expect(src).toContain('const missingFreeModels = byProvider(');
    expect(src).toContain('const missingGroqModels = byProvider(');
  });

  it('keeps null meaning "could not look", not "nothing is missing"', () => {
    // The one line that must not be simplified: an unreadable catalogue that
    // reported [] would claim every pinned model is fine.
    expect(src).toContain("v.live === null ? null : v.missing");
  });
});

describe('the health probe asks for a model the chain serves', () => {
  // This probed `llama-3.1-8b-instant` long after Groq withdrew the whole
  // llama-3.x family — groq-models.ts names that retirement in its own
  // comments. So the Groq health status, and `catCanAnswer` derived from it,
  // came from asking for a decommissioned model. The OpenRouter probe directly
  // below it carries a comment warning about exactly this drift: the fix was
  // applied there and not here.
  const src = readFileSync(
    join(__dirname, '../../../src/services/cat/health-probes.ts'),
    'utf8'
  );

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
