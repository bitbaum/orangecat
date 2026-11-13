'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  CREATE_OPTIONS,
  CREATE_PAGE,
  CREATE_RAISE_ROW,
  groupCreateOptions,
  type CreateOption,
} from '@/config/create-options';
import { ROUTES } from '@/config/routes';

interface CreateOptionListProps {
  /** Called after a row is chosen (a sheet or menu closes itself). */
  onNavigate?: () => void;
  /**
   * Wraps each row's link — the header menu wraps them in DropdownMenuItem so
   * arrow keys move between rows. Must render the link it is given.
   */
  wrapRow?: (row: ReactElement, key: string) => ReactNode;
  /** Anything a surface adds of its own, drawn above the way to the full map. */
  extra?: ReactNode;
  /**
   * The create page for the kind of thing on screen (the phone tab bar passes
   * the page's own kind). That row is drawn first, under "For this page".
   */
  suggestedHref?: string;
  className?: string;
}

const ROW = 'flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-raised';
const LIST = 'divide-y divide-subtle rounded-lg border border-default bg-surface-base';
const HEADING = 'mb-2 text-xs font-semibold uppercase tracking-wider text-fg-secondary';

/**
 * The one create list: the /create page, the phone's Create sheet and the
 * header's Create menu all render this, so the three have one row anatomy
 * (icon tile, what you came to do, one example, the type's name) and one
 * order — the need-first row, the intents, then the way to the full map.
 * They used to be three components with three anatomies.
 */
export function CreateOptionList({
  onNavigate,
  wrapRow,
  extra,
  suggestedHref,
  className,
}: CreateOptionListProps) {
  const wrap = (row: ReactElement, key: string) => (wrapRow ? wrapRow(row, key) : row);
  const suggested = suggestedHref
    ? CREATE_OPTIONS.find(option => option.href === suggestedHref)
    : undefined;

  return (
    <div className={cn('space-y-6', className)}>
      {suggested && (
        <section aria-labelledby="create-for-this-page">
          <h2 id="create-for-this-page" className={HEADING}>
            {CREATE_PAGE.forThisPage}
          </h2>
          <ul className={LIST}>
            <li>{wrap(optionRow(suggested, onNavigate), `suggested-${suggested.href}`)}</li>
          </ul>
        </section>
      )}

      {/* Most people who need money arrive with a need, not a type. */}
      <div className={LIST}>
        {wrap(
          <Link href={CREATE_RAISE_ROW.href} onClick={onNavigate} className={cn(ROW, 'rounded-lg')}>
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-fg-primary">{CREATE_RAISE_ROW.title}</span>
              <span className="block text-sm text-fg-secondary">
                {CREATE_RAISE_ROW.description}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
          </Link>,
          CREATE_RAISE_ROW.href
        )}
      </div>

      {groupCreateOptions().map(group => (
        <section key={group.category} aria-labelledby={`create-${group.category}`}>
          <h2 id={`create-${group.category}`} className={HEADING}>
            {group.label}
          </h2>
          <ul className={LIST}>
            {group.items.map(option => (
              <li key={option.href}>{wrap(optionRow(option, onNavigate), option.href)}</li>
            ))}
          </ul>
        </section>
      ))}

      {extra}

      <div className={LIST}>
        {wrap(
          <Link
            href={ROUTES.WHAT_YOU_CAN_DO}
            onClick={onNavigate}
            className={cn(ROW, 'min-h-11 rounded-lg text-sm text-fg-secondary')}
          >
            <span className="min-w-0 flex-1">{CREATE_PAGE.browseAll}</span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
          </Link>,
          ROUTES.WHAT_YOU_CAN_DO
        )}
      </div>
    </div>
  );
}

/** A plain <Link> element (not a component), so a wrapper's Slot can merge into it. */
function optionRow(option: CreateOption, onNavigate?: () => void): ReactElement {
  const Icon = option.icon;
  return (
    <Link href={option.href} onClick={onNavigate} className={ROW}>
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          option.bgColor
        )}
      >
        <Icon className={cn('h-5 w-5', option.color)} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-fg-primary">{option.name}</span>
        <span className="block text-sm text-fg-secondary">{option.description}</span>
      </span>
      {option.typeLabel && (
        <span className="shrink-0 text-xs text-fg-secondary">{option.typeLabel}</span>
      )}
    </Link>
  );
}
