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
  const src = require('node:fs').readFileSync(
    require('node:path').join(__dirname, '../../../src/services/cat/health-probes.ts'),
    'utf8'
  ) as string;

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
