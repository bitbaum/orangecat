'use client';

/**
 * One entry, tapped: what, when, where, who put it there, and Remove for an
 * entry of your own. A task due that day leads to the to-do list instead.
 */

import Link from 'next/link';
import { Sheet } from '@bitbaum/chatkit/react';
import { formatTime, isWallTime, type ISODate } from '@bitbaum/whenkit';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import type { CalendarPageRow } from '@/services/planner/calendar-page';
import { APP_LOCALE } from '@/utils/locale';
import { dayHeading } from '../days';
import { CALENDAR_COPY } from './copy';

export function EventSheet({
  open,
  row,
  day,
  today,
  busy,
  onClose,
  onRemove,
}: {
  open: boolean;
  row: CalendarPageRow | null;
  day: ISODate | null;
  today: ISODate;
  busy: boolean;
  onClose: () => void;
  onRemove: (entryId: string) => void;
}) {
  const time = row
    ? row.time
        .split(' to ')
        .map(t => (isWallTime(t) ? formatTime(t, APP_LOCALE) : t))
        .join(' – ')
    : '';
  return (
    <Sheet open={open} onClose={onClose} title={row?.title ?? ''} closeLabel={CALENDAR_COPY.close}>
      {row && day && (
        <div className="flex flex-col gap-4 p-4">
          <dl className="m-0 flex flex-col gap-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-fg-tertiary">When</dt>
              <dd className="m-0 text-base text-fg-primary">
                {dayHeading(day, today)} · {time}
              </dd>
            </div>
            {row.location && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-fg-tertiary">Where</dt>
                <dd className="m-0 text-base text-fg-primary">{row.location}</dd>
              </div>
            )}
            {(row.madeBy || CALENDAR_COPY.source[row.source]) && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-fg-tertiary">From</dt>
                <dd className="m-0 text-base text-fg-primary">
                  {row.madeBy ? CALENDAR_COPY.madeBy(row.madeBy) : CALENDAR_COPY.source[row.source]}
                </dd>
              </div>
            )}
          </dl>
          {row.entryId ? (
            <Button
              type="button"
              variant="danger"
              disabled={busy}
              onClick={() => onRemove(row.entryId as string)}
            >
              {CALENDAR_COPY.remove}
            </Button>
          ) : row.source === 'task' || row.source === 'reminder' ? (
            <Button href={ROUTES.DASHBOARD.TASKS} variant="outline">
              {CALENDAR_COPY.openTasks}
            </Button>
          ) : null}
          {row.source === 'google' && (
            <Link
              href={ROUTES.DASHBOARD.CAT_SETTINGS}
              className="text-sm text-fg-secondary underline"
            >
              Google calendar settings
            </Link>
          )}
        </div>
      )}
    </Sheet>
  );
}
