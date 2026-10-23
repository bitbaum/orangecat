/**
 * The nightly Cat eval pins its model as a LITERAL in scripts/eval-cat.mjs,
 * because that script runs on the box where only the standalone build ships
 * and src/ is absent — it cannot import the registry at runtime.
 *
 * That literal drifted once already and killed the gate: it pinned
 * 'openai/gpt-oss-120b:free' long after the registry reclassified
 * 'openai/gpt-oss-120b' as PAID (only the 20b variant stayed free). Every
 * probe came back HTTP 402 INSUFFICIENT_CREDITS, which the harness reported
 * as a "provider layer" failure — so the nightly quality gate was dead from
 * the day Cat Credits shipped and the error pointed at the wrong layer.
 *
 * This test is the contract the literal cannot escape.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { DEFAULT_FREE_MODEL_ID, AI_MODEL_REGISTRY } from '@/config/ai-models';

describe('eval-cat.mjs pinned model', () => {
  const source = readFileSync(path.join(process.cwd(), 'scripts/eval-cat.mjs'), 'utf8');

  it('pins exactly the registry default free model', () => {
    // The openrouter branch of the EVAL_MODEL default.
    const match = source.match(/EVAL_PROVIDER === 'groq'\s*\?\s*'[^']+'\s*:\s*'([^']+)'/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe(DEFAULT_FREE_MODEL_ID);
  });

  it('pins a model the registry actually marks free — a paid pin means every probe 402s', () => {
    const match = source.match(/EVAL_PROVIDER === 'groq'\s*\?\s*'[^']+'\s*:\s*'([^']+)'/);
    const pinned = match![1];
    const entry = (AI_MODEL_REGISTRY as Record<string, { isFree?: boolean; tier?: string }>)[
      pinned
    ];
    expect(entry).toBeDefined();
    expect(entry.isFree === true || entry.tier === 'free').toBe(true);
  });

  it('the registry default free model is itself marked free', () => {
    const entry = (AI_MODEL_REGISTRY as Record<string, { isFree?: boolean; tier?: string }>)[
      DEFAULT_FREE_MODEL_ID
    ];
    expect(entry).toBeDefined();
    expect(entry.isFree === true || entry.tier === 'free').toBe(true);
  });
});
