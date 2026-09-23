/**
 * Cat may not claim a neighbour does something nobody said it does.
 *
 * Every claim carries a source; the brief carries the generated block verbatim.
 */

import { NEIGHBOURS, neighbourCapabilityBrief } from '@/config/neighbour-capabilities';
import { BASE_SYSTEM_PROMPT_FOR_TEST } from '@/services/cat/system-prompt';

const ALL_CLAIMS = Object.values(NEIGHBOURS).flatMap(n => [...n.can, ...n.cannot]);

describe('every claim about a neighbour is sourced', () => {
  it('has at least one claim per neighbour, in both directions', () => {
    for (const n of Object.values(NEIGHBOURS)) {
      expect(n.can.length).toBeGreaterThan(0);
      expect(n.cannot.length).toBeGreaterThan(0);
    }
  });

  it.each(ALL_CLAIMS.map(c => [c.says.slice(0, 48), c] as const))(
    'names where the neighbour says it about itself: %s',
    (_label, claim) => {
      expect(claim.source.trim()).not.toBe('');
      expect(claim.source.length).toBeGreaterThan(20);
    }
  );

  it('never promises a date, and never claims Solon moves money', () => {
    const text = neighbourCapabilityBrief().toLowerCase();
    expect(text).toContain('cannot promise a delivery date');
    expect(text).toContain('watch-only');
  });
});

describe('the brief speaks about neighbours only through the config', () => {
  it('carries the generated block verbatim', () => {
    expect(BASE_SYSTEM_PROMPT_FOR_TEST).toContain(neighbourCapabilityBrief());
  });
});
