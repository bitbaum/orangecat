'use client';

import { Command } from 'cmdk';
import { ArrowRight } from 'lucide-react';
import { Highlight } from './Highlight';
import type { PaletteItem, RankedItem } from './command-palette-items';
import type { Range } from '@bitbaum/searchkit';
import { cn } from '@/lib/utils';

// Styles the HEADING only. On the group itself the uppercase was inherited by
// every row, so results read in capitals ("BITCOIN MEETUP ZÜRICH").
export const GROUP_HEADING =
  'mt-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-tertiary';

export function PaletteGroup({
  heading,
  items,
  query,
  onPick,
}: {
  heading: string;
  items: RankedItem[];
  query: string;
  onPick: (href: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <Command.Group heading={heading} className={GROUP_HEADING}>
      {items.map(item => (
        <PaletteRow
          key={item.id}
          value={item.id}
          icon={item.icon}
          label={item.label}
          hint={item.hint}
          query={query}
          labelRanges={item.labelRanges}
          hintRanges={item.hintRanges}
          onSelect={() => onPick(item.href)}
        />
      ))}
    </Command.Group>
  );
}

interface PaletteRowProps {
  value: string;
  icon: PaletteItem['icon'];
  label: string;
  hint?: string;
  query?: string;
  /** What matched, from a ranked search; typo matches included. */
  labelRanges?: readonly Range[];
  hintRanges?: readonly Range[];
  muted?: boolean;
  onSelect: () => void;
}

export function PaletteRow({
  value,
  icon: Icon,
  label,
  hint,
  query = '',
  labelRanges,
  hintRanges,
  muted,
  onSelect,
}: PaletteRowProps) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className={cn(
        'group flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm sm:min-h-0',
        'aria-selected:bg-surface-raised/60 aria-selected:text-fg-primary',
        'text-fg-secondary transition-colors'
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className={cn('min-w-0 truncate', muted ? 'text-fg-tertiary' : 'text-fg-primary')}>
        <Highlight text={label} query={query} ranges={labelRanges} />
      </span>
      {hint && (
        <span className="hidden min-w-0 flex-1 truncate text-xs text-fg-tertiary sm:inline">
          <Highlight text={hint} query={query} ranges={hintRanges} />
        </span>
      )}
      <ArrowRight className="ml-auto h-3.5 w-3.5 flex-shrink-0 opacity-0 group-aria-selected:opacity-100" />
    </Command.Item>
  );
}
