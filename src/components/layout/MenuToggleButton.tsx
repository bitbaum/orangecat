/**
 * Menu Toggle Button — sidebar / mobile-menu trigger.
 *
 * Thin wrapper over the shared HeaderIconButton primitive so it shares the
 * header rail's geometry and hover treatment with every other action.
 */

import { Menu } from 'lucide-react';
import { forwardRef } from 'react';
import { HeaderIconButton } from './HeaderIconButton';
import { cn } from '@/lib/utils';

interface MenuToggleButtonProps {
  /** Click handler */
  onClick: () => void;
  /** Aria label for accessibility */
  ariaLabel: string;
  /** Whether the menu this button opens is open (omit for a button that opens nothing modal). */
  expanded?: boolean;
  /** The id of the element this button opens. */
  controls?: string;
  /** Additional CSS classes */
  className?: string;
}

export const MenuToggleButton = forwardRef<HTMLButtonElement, MenuToggleButtonProps>(
  ({ onClick, ariaLabel, expanded, controls, className }, ref) => (
    <HeaderIconButton
      ref={ref}
      icon={Menu}
      label={ariaLabel}
      onClick={onClick}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-haspopup={controls ? 'dialog' : undefined}
      className={cn('lg:hidden', className)}
    />
  )
);

MenuToggleButton.displayName = 'MenuToggleButton';
