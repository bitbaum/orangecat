'use client';

/**
 * SettingToggleRow — one on/off setting, one shape.
 *
 * On/off rows came in five shapes: a checkbox with "On"/"Off" text beside it,
 * switches with no name, a label that said "Website" where on meant hidden, a
 * card around one switch. A row is now the name and one line of detail on the
 * left, the switch on the right, the whole row a 44px target, and the switch
 * named by the visible words. Put rows in a `divide-y divide-subtle` list.
 */

import { useId } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface SettingToggleRowProps {
  /** What turning it on does, in words; also the switch's accessible name. */
  label: string;
  detail?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Optional mark before the label, e.g. a small icon. */
  leading?: React.ReactNode;
  className?: string;
}

export function SettingToggleRow({
  label,
  detail,
  checked,
  onCheckedChange,
  disabled = false,
  leading,
  className,
}: SettingToggleRowProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const detailId = `${id}-detail`;

  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center justify-between gap-4 py-3',
        disabled && 'cursor-not-allowed',
        className
      )}
    >
      <span className="flex min-w-0 items-start gap-3">
        {leading}
        <span className="min-w-0">
          <span id={labelId} className="block text-sm font-medium text-fg-primary">
            {label}
          </span>
          {detail && (
            <span id={detailId} className="mt-0.5 block text-sm text-fg-secondary">
              {detail}
            </span>
          )}
        </span>
      </span>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={detail ? detailId : undefined}
      />
    </label>
  );
}
