/**
 * Mobile-only sticky bottom CTA for the public entity detail page. Extracted
 * from PublicEntityDetailPage.tsx to keep that component under 300 lines.
 * On <md it keeps the primary visitor action one tap from any scroll position.
 */
import { getEntityPrimaryCta } from '@/config/entity-cta';
import { Z_INDEX_CLASSES } from '@/constants/z-index';
import type { EntityDetailConfig, EntityData } from './public-entity-detail-config';
import { useMobileActionBar } from '@/hooks/useMobileActionBar';

export function MobileStickyCTA({
  config,
  entity,
  payable,
}: {
  config: EntityDetailConfig;
  entity: EntityData;
  /** True when the seller has a connected wallet (sellerReceive resolved). */
  payable: boolean;
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
    cta = config.mobileStickyCTA(entity);
  } else if (config.mobileStickyCTA) {
    cta = config.mobileStickyCTA;
  } else if (config.showPaymentSection !== false) {
    cta = { href: '#pay', label: getEntityPrimaryCta(config.entityType) };
  }
  if (!cta) {
    return null;
  }

  // A pay-anchored sticky CTA ("Buy now", "Fund this project") on a listing whose
  // owner has NO connected wallet promises an action that can't complete — tapping
  // it only scrolls to the "creator hasn't connected a wallet yet" notice. Hide it.
  if (cta.href === '#pay' && !payable) {
    return null;
  }

  return <StickyBar href={cta.href} label={cta.label} />;
}

function StickyBar({ href, label }: { href: string; label: string }) {
  useMobileActionBar(true);
  // Position + z-index sourced from SSOT:
  //   .oc-above-mobile-nav  → globals.css (--mobile-nav-clearance)
  //   Z_INDEX_CLASSES.MOBILE_ACTION_BAR → src/constants/z-index.ts
  // Pair on the parent: .oc-mobile-action-stack-padding (already added
  // to the page wrapper) reserves matching scroll-bottom room.
  return (
    <div
      className={`md:hidden fixed inset-x-0 oc-above-mobile-nav ${Z_INDEX_CLASSES.MOBILE_ACTION_BAR} border-t border-subtle bg-surface-base/95 backdrop-blur supports-[backdrop-filter]:bg-surface-base/80 px-4 py-3 shadow-sm`}
    >
      <a
        href={href}
        className="flex w-full items-center justify-center gap-2 rounded-md bg-fg-primary px-4 py-3 text-sm font-semibold text-fg-inverted hover:bg-fg-primary/90 transition-colors min-h-12"
      >
        {label}
      </a>
    </div>
  );
}
