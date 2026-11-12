'use client';

/**
 * The bar itself. A client component because it marks the page while it is
 * shown (useMobileActionBar), and a hook cannot run on the server: when this
 * lived inside the server-rendered MobileStickyCTA, every public listing page
 * with a sticky action crashed to "Something went wrong" once it loaded.
 */
import { Z_INDEX_CLASSES } from '@/constants/z-index';
import { useMobileActionBar } from '@/hooks/useMobileActionBar';
import { useSectionInView } from '@/hooks/useSectionInView';

export function StickyBar({ href, label }: { href: string; label: string }) {
  // The bar steps aside while the section it leads to (#pay) is on screen, as
  // the project page's Fund bar does: there it covered the open invoice's
  // "Hide the code" on causes, products and every other entity (390px).
  const targetInView = useSectionInView(href.startsWith('#') ? href.slice(1) : null);
  useMobileActionBar(!targetInView);
  if (targetInView) {
    return null;
  }
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
