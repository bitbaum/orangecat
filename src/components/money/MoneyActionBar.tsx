'use client';

/**
 * MoneyActionBar — keeps the committing action reachable.
 *
 * The money forms are taller than a phone. On an iPhone SE the recipient field,
 * the amount, the presets and the note already fill the viewport, so the button
 * that actually does the thing sits below the fold: you scroll, lose sight of
 * the amount you just typed, and tap a button with nothing else on screen.
 *
 * So it sticks to the bottom on small screens, the way every banking app does
 * it, and returns to normal flow from `sm:` up where the whole form fits at
 * once. `sticky` rather than `fixed` on purpose — a fixed bar overlaps the last
 * field when the software keyboard opens.
 *
 * It sticks ABOVE the bottom tab bar, not to the bottom of the viewport: the
 * tab bar is fixed there and drawn over this bar, which left "Review payment"
 * underneath it (the button's centre hit-tested to the tab bar's Receive
 * button at 390x844, 390x667 and 320x568). While the software keyboard is up
 * the tab bar is gone, so the bar goes back to the bottom edge and takes the
 * iPhone home-indicator inset itself.
 */

import { useSoftKeyboard } from '@/hooks/useSoftKeyboard';
import { cn } from '@/lib/utils';

export function MoneyActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const keyboardOpen = useSoftKeyboard();

  return (
    <div
      className={cn(
        'sticky z-10 -mx-4 mt-2 border-t border-default bg-surface-page/95 px-4 pt-3 backdrop-blur',
        keyboardOpen
          ? 'bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          : 'bottom-[var(--mobile-nav-clearance)] pb-3',
        'sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none',
        className
      )}
    >
      {children}
    </div>
  );
}
