/**
 * OrangeCat Domains — SSOT for the hosting offer /domains sells.
 *
 * `CUSTOM_DOMAIN_PRICE_CHF_PER_YEAR === null` means the plan exists but its
 * price is deliberately not announced yet: the page shows the tier with
 * "pricing to be announced" and the payable service entity is held at 0. To
 * launch a price, set the number here AND update the service entity's
 * `fixed_price` to match — they are the display side and the charge side of
 * the same offer, and only the entity actually collects money.
 *
 * Per YEAR, because that is the unit the cost comes in: a domain is registered
 * for a year at a time, and the intended price is the registrar's own yearly
 * fee passed through (about CHF 10 for a .ch or .com), not a hosting margin
 * dressed as a monthly plan. See docs/forward-looking/planning/
 * 2026-09-14-open-flow-plan.md for the launch steps and the decision.
 */

/** The live, payable service entity the /domains page sells. */
export const DOMAINS_SERVICE_URL = '/services/25baeba0-46bc-4666-a2fb-bd845f45fd14';

/**
 * The rung BEFORE hosting: a visitor with no site yet needs one built. Linked,
 * never priced here — the service entity owns its own rate, so restating a
 * number in this page would be the second source of truth this file exists to
 * prevent.
 */
export const WEBSITE_BUILD_SERVICE_URL = '/services/30557b9d-fcea-4544-bff0-7007829664ad';

/** Custom-domain tier price per year. null = to be announced (free during early access). */
export const CUSTOM_DOMAIN_PRICE_CHF_PER_YEAR: number | null = null;

/**
 * The base every free hosted site sits on: `<name>.orangecat.ch`.
 *
 * Matches `SITES_BASE_DOMAIN` in the fleet's own provisioning
 * (loki scripts/hetzner/_box-env.sh), which is what actually creates the
 * vhost. Two constants that must agree and cannot see each other — if the fleet
 * ever moves off orangecat.ch, this line moves with it or the page starts
 * promising a host nobody serves.
 */
export const FREE_SUBDOMAIN_BASE = 'orangecat.ch';

/**
 * The address proposed by default for a given name.
 *
 * This is the ANSWER for most visitors, not the consolation prize: a working
 * address today, at no cost, with the option to move to a bought domain later
 * and keep every link alive. It is offered as the default precisely so that
 * "I haven't bought a domain" stops being a reason not to start.
 *
 * Returns null for an empty label rather than the bare base domain — a link to
 * `orangecat.ch` presented as "your site" would send the visitor to this
 * platform's own homepage.
 */
export function freeSubdomainHost(label: string): string | null {
  const clean = label.trim().toLowerCase();
  return clean ? `${clean}.${FREE_SUBDOMAIN_BASE}` : null;
}
