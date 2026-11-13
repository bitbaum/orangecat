/**
 * HeaderIconButton — SSOT primitive for every icon button in the global header rail.
 *
 * Before this existed, each header action (menu toggle, search, messages,
 * notifications, theme, create) hand-rolled its own size, icon size, radius
 * and hover treatment, so the rail never lined up. This component is the one
 * place that defines header-rail button geometry and interaction states.
 *
 * Geometry: 44×44 touch target on mobile (a11y minimum), 40×40 on desktop.
 * Icon: always h-5 w-5 so every button reads at the same visual weight.
 * Radius/transition/focus: from the shared design-system control tokens.
 */

'use client';

import { forwardRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NotificationBadge } from '@/components/ui/NotificationBadge';
import { cn } from '@/lib/utils';

/** SSOT class fragments for the header rail. */
export const HEADER_ICON_BUTTON = {
  base: cn(
    'relative inline-flex shrink-0 items-center justify-center',
    'w-11 h-11 min-w-11 min-h-11 sm:w-10 sm:h-10 sm:min-w-10 sm:min-h-10',
    'rounded-md transition-colors duration-150 touch-manipulation select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50'
  ),
  variants: {
    ghost: 'text-fg-secondary hover:text-fg-primary hover:bg-surface-overlay',
    inverse: 'bg-fg-primary text-fg-inverted hover:bg-muted-strong',
  },
  active: {
    ghost: 'bg-surface-overlay text-fg-primary',
    inverse: 'bg-muted-strong',
  },
} as const;

interface HeaderIconButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  /** Lucide icon rendered at the canonical header icon size (h-5 w-5). */
  icon: LucideIcon;
  /** Required — these buttons are icon-only, so they need an accessible name. */
  label: string;
  /** Unread badge count; hidden when 0. */
  badgeCount?: number;
  /** Visual treatment. `ghost` for actions, `inverse` for the primary create CTA. */
  variant?: keyof typeof HEADER_ICON_BUTTON.variants;
  /** Pressed/open state (e.g. an open dropdown). */
  active?: boolean;
  /** Extra classes on the icon itself — for transforms like rotate on toggle. */
  iconClassName?: string;
}

export const HeaderIconButton = forwardRef<HTMLButtonElement, HeaderIconButtonProps>(
  (
    {
      icon: Icon,
      label,
      badgeCount = 0,
      variant = 'ghost',
      active = false,
      iconClassName,
      className,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        className={cn(
          HEADER_ICON_BUTTON.base,
          HEADER_ICON_BUTTON.variants[variant],
          active && HEADER_ICON_BUTTON.active[variant],
          className
        )}
        {...rest}
      >
        <Icon className={cn('h-5 w-5', iconClassName)} />
        <NotificationBadge count={badgeCount} />
      </button>
    );
  }
);

HeaderIconButton.displayName = 'HeaderIconButton';
