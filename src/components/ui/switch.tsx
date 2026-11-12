'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils';

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // The track is 44x24; the pseudo-element extends the hit area to 44x44
      // (insets are measured from the 40x20 padding box inside the border).
      // Off is an outline and on is a fill, so the state does not rest on
      // the thumb's position alone.
      'peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors after:absolute after:-inset-x-0.5 after:-inset-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-transparent data-[state=checked]:bg-primary data-[state=unchecked]:border-fg-tertiary data-[state=unchecked]:bg-transparent',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-surface-page data-[state=unchecked]:translate-x-0 data-[state=unchecked]:scale-75 data-[state=unchecked]:bg-fg-tertiary'
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
