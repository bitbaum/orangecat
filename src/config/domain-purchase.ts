/**
 * Where a name found on /domains actually gets bought — SSOT.
 *
 * The search could tell you a name was free and then leave you there, which is
 * the shape of a tool that answers a question nobody asked in isolation. Nobody
 * checks a domain for fun; they check it because they want the site. So a free
 * result carries the next step, and the step that costs nothing is offered
 * beside it rather than buried under it.
 *
 * ORANGECAT IS NOT A REGISTRAR AND MUST NOT LOOK LIKE ONE.
 *
 * These links hand the visitor to a third party who takes their money and
 * becomes their counterparty for that domain. There is no affiliate code in any
 * URL here and no revenue attached to the choice — if that ever changes, say so
 * on the page in the same breath, because an undisclosed referral on a page
 * whose whole value is honest availability data would poison the data too.
 *
 * Every URL below was fetched and returns 200 before being added. That is not
 * ceremony: the first three registrar deep-links guessed for this file
 * (Infomaniak's and Hostpoint's search endpoints, in two shapes) all 404'd, and
 * a dead "Register this domain" button is worse than no button — it spends the
 * one moment of intent the page ever gets. Re-check before editing.
 *
 * Created: 2026-09-10
 */

export interface Registrar {
  id: string;
  name: string;
  /** Why a visitor might pick this one. One honest line, no marketing. */
  note: string;
  /**
   * Deep link to this registrar's checkout/search for a specific domain, or
   * null when the registrar publishes no such URL — then `homeUrl` is used and
   * the visitor types the name again. Prefer a deep link; a re-type loses people.
   */
  searchUrl: ((domain: string) => string) | null;
  homeUrl: string;
}

/**
 * Ordered: the deep-linkable one first, because it is the only one that can
 * carry the name the visitor already typed.
 */
export const REGISTRARS: readonly Registrar[] = [
  {
    id: 'porkbun',
    name: 'Porkbun',
    note: 'Deep-links straight to this name. Handles .ch as well as .com.',
    searchUrl: domain => `https://porkbun.com/checkout/search?q=${encodeURIComponent(domain)}`,
    homeUrl: 'https://porkbun.com',
  },
  {
    id: 'infomaniak',
    name: 'Infomaniak',
    note: 'Swiss registrar, Swiss hosting and invoicing — you re-enter the name.',
    // No verified per-domain search URL: the two shapes tried both 404'd, so
    // this deliberately lands on the domains page rather than inventing one.
    searchUrl: null,
    homeUrl: 'https://www.infomaniak.com/en/domains',
  },
];

/** The registrar offered first for a given domain. */
export function primaryRegistrar(): Registrar {
  return REGISTRARS[0];
}

/** Where to send someone who wants to buy `domain` at `registrar`. */
export function purchaseUrl(registrar: Registrar, domain: string): string {
  return registrar.searchUrl ? registrar.searchUrl(domain) : registrar.homeUrl;
}

/**
 * Buying is offered ONLY for names the registry said are unregistered.
 *
 * An `unknown` result means nothing could be concluded — offering "Register
 * this domain" there would launder a non-answer into an invitation, which is
 * the exact false positive the availability service refuses to produce. Let the
 * server's honesty survive the trip to the UI.
 */
export function canOfferPurchase(status: string): boolean {
  return status === 'unregistered';
}
