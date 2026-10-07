'use client';

/**
 * Date and date-time inputs for the entity form.
 *
 * `date` used to fall through to a text box: no picker, and an edit form
 * showed the stored "2026-06-12T00:00:00+00:00" verbatim. `datetime` is a
 * wall-clock time with no offset — the server reads it in the entity's own
 * zone (resolveEventTimes), and the config converts stored instants back into
 * that zone before the form sees them.
 */

import { Input } from '@/components/ui/Input';
import { browserTimeZone, instantToWallTime } from '@/utils/timezone';

interface DateInputProps {
  id: string;
  kind: 'date' | 'datetime';
  value: unknown;
  onChange: (value: string | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  className?: string;
}

export function DateInput({ id, kind, value, onChange, ...rest }: DateInputProps) {
  const text = typeof value === 'string' ? value : '';
  return (
    <Input
      id={id}
      type={kind === 'date' ? 'date' : 'datetime-local'}
      value={
        kind === 'date' ? text.slice(0, 10) : text && instantToWallTime(text, browserTimeZone())
      }
      onChange={e => onChange(e.target.value || null)}
      {...rest}
    />
  );
}
