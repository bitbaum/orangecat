/**
 * `verify` runs its steps in parallel lanes on CI and in one serial line
 * locally. Two lists describe the same checks, so they must never disagree: a
 * check added to only one of them would run on a laptop and silently not on
 * CI (or the reverse) — the gate everyone trusts, quietly thinner.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — plain ESM script, no type declarations
import { LANES, SERIAL } from '../../../scripts/verify.mjs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
const laneSteps = (LANES as string[][]).flat();

describe('verify lanes', () => {
  it('runs exactly the same checks in parallel and in serial', () => {
    expect([...laneSteps].sort()).toEqual([...(SERIAL as string[])].sort());
  });

  it('runs every check once', () => {
    expect(new Set(laneSteps).size).toBe(laneSteps.length);
  });

  it('names only scripts that exist', () => {
    expect(laneSteps.filter(s => !pkg.scripts[s])).toEqual([]);
  });

  it('is what `pnpm run verify` runs', () => {
    expect(pkg.scripts.verify).toBe('node scripts/verify.mjs');
  });

  it('still includes the unit suite, type-check and lint', () => {
    expect(laneSteps).toEqual(expect.arrayContaining(['test:unit', 'type-check', 'lint']));
  });
});
