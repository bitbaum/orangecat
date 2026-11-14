'use client';

/**
 * Add by typing, when speaking will not do: the one line and its chips, in a
 * sheet, starting from the day (and hour) that was tapped to get here.
 */

import { Sheet } from '@bitbaum/chatkit/react';
import type { ISODate } from '@bitbaum/whenkit';
import type { QuickAdd as Parsed } from '@/services/planner/quick-add';
import { QuickAdd } from '../QuickAdd';
import { CALENDAR_COPY } from './copy';

export function AddSheet({
  open,
  today,
  day,
  time,
  busy,
  onClose,
  onAdd,
}: {
  open: boolean;
  today: ISODate;
  day: ISODate;
  time: string | null;
  busy: boolean;
  onClose: () => void;
  onAdd: (entry: Parsed) => Promise<boolean>;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={CALENDAR_COPY.quick.label}
      closeLabel={CALENDAR_COPY.close}
    >
      <div className="oc-planner flex flex-col gap-3 p-4">
        {open && (
          <QuickAdd
            // A fresh line for every opening, starting from what was tapped.
            key={`${day}-${time ?? ''}`}
            kind="calendar"
            today={today}
            copy={CALENDAR_COPY.quick}
            busy={busy}
            initialDay={day}
            initialTime={time}
            autoFocus
            onAdd={async entry => {
              const ok = await onAdd(entry);
              if (ok) {
                onClose();
              }
              return ok;
            }}
          />
        )}
        <p className="mb-0 text-sm text-fg-secondary">{CALENDAR_COPY.hint}</p>
      </div>
    </Sheet>
  );
}
