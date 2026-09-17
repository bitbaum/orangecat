/**
 * Cat may not claim a neighbour does something nobody said it does.
 *
 * The failure this pins is real and was shipped: asked to plan a project
 * across the three products, Cat answered "Solon can set up the governance".
 * `solon` appeared nowhere in its brief, so it guessed from the name — and
 * guessed close, which is the dangerous kind, because a lucky guess reads as
 * knowledge and nobody goes and checks it.
 *
 * Two invariants, and the second is the one with teeth:
 *
 *   1. Every claim carries a source. A line nobody can attribute is a line
 *      nobody may add.
 *   2. The prompt talks about a neighbour ONLY through this config. Prose
 *      about Solon or Loki written directly into the brief is how the copy
 *      comes back, and a copy is what drifts.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { NEIGHBOURS, neighbourCapabilityBrief } from '@/config/neighbour-capabilities';
import { BASE_SYSTEM_PROMPT_FOR_TEST } from '@/services/cat/system-prompt';

const ALL_CLAIMS = Object.values(NEIGHBOURS).flatMap(n => [...n.can, ...n.cannot]);

describe('every claim about a neighbour is sourced', () => {
  it('has at least one claim per neighbour, in both directions', () => {
    for (const n of Object.values(NEIGHBOURS)) {
      expect(n.can.length).toBeGreaterThan(0);
      // `cannot` is not optional. A capability list with no limits is a sales
      // page, and it is the half that stops Cat promising a neighbour's help
      // with something the neighbour refuses to do.
      expect(n.cannot.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_CLAIMS.map(c => [c.says.slice(0, 48), c] as const))(
    'names where the neighbour says it about itself: %s',
    (_label, claim) => {
      expect(claim.source.trim()).not.toBe('');
      // Long enough to identify a producer — "docs" or "obvious" is not one.
      expect(claim.source.length).toBeGreaterThan(20);
    }
  );

  it('never promises a date, and never claims Solon moves money', () => {
    const text = neighbourCapabilityBrief().toLowerCase();
    // Both were live failure modes: a delivery date nobody can back, and a
    // watch-only treasury described as if it held funds.
    expect(text).toContain('cannot promise a delivery date');
    expect(text).toContain('watch-only');
  });
});

describe('the brief speaks about neighbours only through the config', () => {
  const prompt = BASE_SYSTEM_PROMPT_FOR_TEST;

  it('carries the generated block verbatim', () => {
    expect(prompt).toContain(neighbourCapabilityBrief());
  });

  it('hard-codes no neighbour prose in the brief itself', () => {
    // Checked against the SOURCE, not the rendered prompt, because the rendered
    // prompt legitimately names Solon twice more: the capability block above,
    // and `propose_governance_change`'s own description in the action registry.
    // Both are producers. What must never come back is a paragraph about a
    // neighbour typed straight into the brief — that is the copy that drifts,
    // and it is what said "Solon can set up the governance".
    const src = readFileSync(join(process.cwd(), 'src/services/cat/system-prompt.ts'), 'utf8');
    const prose = src
      .split('\n')
      .filter(l => !l.includes('neighbour-capabilities'))
      .join('\n');
    expect(prose.toLowerCase()).not.toContain('solon');
  });
});
