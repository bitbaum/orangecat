/**
 * Handing a question across, without losing it.
 *
 * Three products, and the join between them was a home-page link: someone
 * described what they wanted in one place and started again in another.
 * Retyping is where a handoff is lost, and it is a large part of why the three
 * have never felt like one thing.
 *
 * Cat already receives one of these (`/dashboard/cat?q=`). Loki now accepts
 * `?name=&brief=` (bitbaum/loki#778). This is the sending half, and what it
 * must never become is a link that ACTS — prefill is a courtesy, not authority.
 */

import * as neighbours from '@/config/neighbour-capabilities';
import { lokiBuildHandoff, NEIGHBOURS } from '@/config/neighbour-capabilities';
import { ECOSYSTEM } from '@/config/ecosystem';

describe('the brief travels with the link', () => {
  it('lands on the page that can receive it', () => {
    const url = new URL(lokiBuildHandoff('a site for my bakery'));
    expect(url.origin).toBe(new URL(ECOSYSTEM.loki.siteUrl).origin);
    expect(url.pathname).toBe('/control/new-from-scratch');
  });

  it('carries the brief, and the name when there is one', () => {
    const url = new URL(lokiBuildHandoff('a site for my bakery', 'bakery-site'));
    expect(url.searchParams.get('brief')).toBe('a site for my bakery');
    expect(url.searchParams.get('name')).toBe('bakery-site');
  });

  it('omits the name rather than sending an empty one', () => {
    const url = new URL(lokiBuildHandoff('something', '   '));
    expect(url.searchParams.has('name')).toBe(false);
  });

  it('caps at exactly what the receiver accepts', () => {
    // Sending more than the other side takes produces a silently truncated
    // brief, which reads to the user as Loki losing the plot.
    const url = new URL(lokiBuildHandoff('x'.repeat(5000), 'y'.repeat(500)));
    expect(url.searchParams.get('brief')).toHaveLength(2000);
    expect(url.searchParams.get('name')).toHaveLength(100);
  });

  it('encodes a brief that would otherwise break the URL', () => {
    const nasty = 'sell "mugs" & cards? #1 — 50% off';
    const url = new URL(lokiBuildHandoff(nasty));
    expect(url.searchParams.get('brief')).toBe(nasty);
  });
});

describe('it does not invent a neighbour that cannot receive', () => {
  it('hands Solon a decision to file, never a question to answer', () => {
    // Solon has no chat and no brief, so there is no "talk to Solon" link — it
    // would point at a page that cannot answer. What its proposal form DOES
    // read is a prefilled draft (bitbaum/solon lib/domain/proposal-draft), so
    // the one Solon handoff carries a decision for a member to file and sign.
    expect(NEIGHBOURS.solon).toBeDefined();
    const exported = Object.keys(neighbours);
    expect(exported.filter(k => k.toLowerCase().includes('handoff')).sort()).toEqual([
      'lokiBuildHandoff',
      'solonProposalHandoff',
    ]);
    const url = new URL(neighbours.solonProposalHandoff({ title: 'Party budget' }));
    expect(url.origin).toBe(new URL(ECOSYSTEM.solon.siteUrl).origin);
    expect(url.pathname).toBe('/propose');
  });
});
