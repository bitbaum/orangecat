/**
 * Mobile-only sticky bottom CTA for the public entity detail page. Extracted
 * from PublicEntityDetailPage.tsx to keep that component under 300 lines.
 * On <md it keeps the primary visitor action one tap from any scroll position,
 * and steps aside while the section it leads to is on screen (StickyBar).
 */
import { getEntityPrimaryCta } from '@/config/entity-cta';
import { formatCurrency } from '@/services/currency';
import type { EntityDetailConfig, EntityData } from './public-entity-detail-config';
import { StickyBar } from './PublicEntityStickyBar';

/**
 * The pay bar's words: the entity's verb and, for a priced listing, the price
 * in the listing's own currency — "Buy now · CHF 20.00" — so the bar says what
 * the tap costs before the pay panel does.
 */
export function stickyPayLabel(config: EntityDetailConfig, entity: EntityData): string {
  const verb = getEntityPrimaryCta(config.entityType);
  const price = config.getPrice?.(entity) ?? null;
  return price && price.amount > 0
    ? `${verb} · ${formatCurrency(price.amount, price.currency)}`
    : verb;
}

export function MobileStickyCTA({
  config,
  entity,
  payable,
  isSignedIn,
  contactHref,
}: {
  config: EntityDetailConfig;
  entity: EntityData;
  /** True when the seller has a connected wallet (sellerReceive resolved). */
  payable: boolean;
  isSignedIn: boolean;
  /** A message to the owner about this listing; null when there is none to send. */
  contactHref: string | null;
}) {
  // Explicit override: entity opted out (null) → no bar.
  if (config.mobileStickyCTA === null) {
    return null;
  }

  // Resolve the CTA {href,label} from the config, or fall back to the default:
  // anchor to the payment section with the entity's own primary verb (SSOT in
  // entity-cta.ts) — "Book this service", "Fund this project", etc.
  let cta: { href: string; label: string } | null = null;
  if (typeof config.mobileStickyCTA === 'function') {
    cta = config.mobileStickyCTA(entity, isSignedIn, contactHref);
  } else if (config.mobileStickyCTA) {
    cta = config.mobileStickyCTA;
  } else if (config.showPaymentSection !== false) {
    cta = { href: '#pay', label: stickyPayLabel(config, entity) };
  }
  if (!cta) {
    return null;
  }

  // A pay-anchored sticky CTA ("Buy now", "Fund this project") on a listing whose
  // owner has NO connected wallet promises an action that can't complete. Replace
  // its action with the one that can: ask the owner how to pay.
  if (cta.href === '#pay' && !payable) {
    return contactHref ? <StickyBar href={contactHref} label="Ask how to pay" /> : null;
  }

  return <StickyBar href={cta.href} label={cta.label} />;
}
