/**
 * The buy flow has one way to be dishonest, and it is the mirror of the search's
 * one way to be dishonest: offering to sell somebody a name nobody confirmed was
 * free. `unknown` means the registry concluded nothing — a "Register this
 * domain" button there launders a non-answer into an invitation, and the person
 * acts on it.
 *
 * The other rule is that the free address must be a real host and never this
 * platform's own homepage wearing the visitor's name.
 */

import {
  canOfferPurchase,
  primaryRegistrar,
  purchaseUrl,
  REGISTRARS,
} from '@/config/domain-purchase';
import { freeSubdomainHost, FREE_SUBDOMAIN_BASE } from '@/config/domains-offer';

describe('purchase is offered only for confirmed-free names', () => {
  it('offers a registrar only on unregistered', () => {
    expect(canOfferPurchase('unregistered')).toBe(true);
  });

  it.each(['unknown', 'registered'])('never offers on %s', status => {
    expect(canOfferPurchase(status)).toBe(false);
  });
});

describe('registrar links', () => {
  it('deep-links the exact domain when the registrar supports it', () => {
    const porkbun = primaryRegistrar();
    expect(porkbun.searchUrl).not.toBeNull();
    expect(purchaseUrl(porkbun, 'causius.ch')).toBe(
      'https://porkbun.com/checkout/search?q=causius.ch'
    );
  });

  it('falls back to the registrar home when there is no verified deep link', () => {
    const infomaniak = REGISTRARS.find(r => r.id === 'infomaniak');
    expect(infomaniak).toBeDefined();
    // Deliberately null — the two guessed search URLs both 404'd, and a dead
    // button costs more than an extra step.
    expect(infomaniak!.searchUrl).toBeNull();
    expect(purchaseUrl(infomaniak!, 'causius.ch')).toBe(infomaniak!.homeUrl);
  });

  it('carries no affiliate or tracking parameters', () => {
    // If a referral is ever added, it must be disclosed on the page in the same
    // breath — this test failing is the prompt to do that, not to delete it.
    for (const registrar of REGISTRARS) {
      const url = purchaseUrl(registrar, 'example.com');
      expect(url).not.toMatch(/[?&](ref|aff|affiliate|utm_|partner|tag)=/i);
      expect(url.startsWith('https://')).toBe(true);
    }
  });

  it('escapes a domain into the query string', () => {
    expect(purchaseUrl(primaryRegistrar(), 'a b.com')).toContain('a%20b.com');
  });
});

describe('the free address', () => {
  it('builds <label>.orangecat.ch', () => {
    expect(freeSubdomainHost('causius')).toBe(`causius.${FREE_SUBDOMAIN_BASE}`);
  });

  it('normalises what it is given', () => {
    expect(freeSubdomainHost('  Causius  ')).toBe(`causius.${FREE_SUBDOMAIN_BASE}`);
  });

  it('returns null for an empty label rather than the bare base domain', () => {
    // `orangecat.ch` offered as "your site" would send the visitor to this
    // platform's own homepage.
    for (const label of ['', '   ']) {
      expect(freeSubdomainHost(label)).toBeNull();
    }
  });
});
