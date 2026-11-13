'use client';

/**
 * SettingsPreferencesSection — how amounts and dates read across OrangeCat.
 *
 * Two values in profiles.currency and profiles.date_format (the SSOTs read by
 * useDisplayCurrency and useDisplayDate platform-wide), written through the
 * same PUT /api/profile path as the profile editor — a second door to the same
 * columns, not a second copy of the data.
 *
 * Each saves the moment it changes, like the notification settings, with the
 * same status line in place of a button: one shared "Save preferences" for two
 * unrelated selects was easy to miss and easy to leave half-saved.
 *
 * `date_format` defaults to 'auto', which is not a format but the absence of a
 * choice: the format is then inferred from where the person says they are, so
 * someone who moves country gets the local convention without coming back here.
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, Coins, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth';
import { API_ROUTES } from '@/config/api-routes';
import { currencySelectOptions, PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { dateFormatSelectOptions, type DateFormatPreference } from '@/config/date-formats';
import { formatClockTime } from '@/utils/locale';
import { logger } from '@/utils/logger';

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: string };

export function SettingsPreferencesSection() {
  const profile = useAuthStore(state => state.profile);
  const fetchProfile = useAuthStore(state => state.fetchProfile);

  const savedCurrency =
    ((profile as Record<string, unknown> | null)?.currency as string | undefined) ||
    PLATFORM_DEFAULT_CURRENCY;
  const savedDateFormat =
    ((profile as Record<string, unknown> | null)?.date_format as
      DateFormatPreference | undefined) || 'auto';

  const [currency, setCurrency] = useState(savedCurrency);
  const [dateFormat, setDateFormat] = useState<DateFormatPreference>(savedDateFormat);
  const [state, setState] = useState<SaveState>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  // Adopt the profile values once they load; don't clobber an in-progress pick.
  useEffect(() => {
    setCurrency(prev => (prev === PLATFORM_DEFAULT_CURRENCY ? savedCurrency : prev));
  }, [savedCurrency]);

  useEffect(() => {
    setDateFormat(prev => (prev === 'auto' ? savedDateFormat : prev));
  }, [savedDateFormat]);

  const save = useCallback(
    async (next: { currency: string; date_format: DateFormatPreference }) => {
      if (!profile?.username) {
        setError('Your profile is still loading. Try again in a moment.');
        return false;
      }
      setState({ kind: 'saving' });
      setError(null);
      try {
        const res = await fetch(API_ROUTES.PROFILE, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: profile.username, ...next }),
        });
        if (!res.ok) {
          throw new Error(`save failed (${res.status})`);
        }
        await fetchProfile();
        setState({ kind: 'saved', at: formatClockTime(new Date()) });
        return true;
      } catch (err) {
        logger.error('Display preference save failed', err, 'Settings');
        setError('Could not save that change. Try again.');
        setState({ kind: 'idle' });
        return false;
      }
    },
    [profile?.username, fetchProfile]
  );

  const changeCurrency = async (value: string) => {
    const previous = currency;
    setCurrency(value);
    if (!(await save({ currency: value, date_format: dateFormat }))) {
      setCurrency(previous); // never show a choice that was not saved
    }
  };

  const changeDateFormat = async (value: DateFormatPreference) => {
    const previous = dateFormat;
    setDateFormat(value);
    if (!(await save({ currency, date_format: value }))) {
      setDateFormat(previous);
    }
  };

  const busy = state.kind === 'saving';

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
          <Coins className="mr-2 h-6 w-6 text-fg-secondary" />
          Display currency
        </h3>
        <p className="mb-4 max-w-prose text-fg-secondary">
          Amounts across OrangeCat show in this currency (converted from BTC). Bitcoin stays the
          canonical unit underneath.
        </p>
        <Select value={currency} onValueChange={changeCurrency} disabled={busy}>
          <SelectTrigger className="min-h-11 w-48" aria-label="Display currency">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencySelectOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <h3 className="mb-2 flex items-center text-lg font-semibold text-fg-primary">
          <CalendarDays className="mr-2 h-6 w-6 text-fg-secondary" />
          Date format
        </h3>
        <p className="mb-4 max-w-prose text-fg-secondary">
          How dates read across OrangeCat. Left on automatic, this follows the country on your
          profile — most of the world writes the day first.
        </p>
        <Select
          value={dateFormat}
          onValueChange={value => changeDateFormat(value as DateFormatPreference)}
          disabled={busy}
        >
          <SelectTrigger className="min-h-11 w-64" aria-label="Date format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateFormatSelectOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="flex min-h-5 items-center gap-1.5 text-xs text-fg-secondary"
        aria-live="polite"
      >
        {error ? (
          <span className="text-status-negative">{error}</span>
        ) : state.kind === 'saving' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
          </>
        ) : state.kind === 'saved' ? (
          <>
            <Check className="h-3.5 w-3.5 text-status-positive" /> Saved {state.at}
          </>
        ) : (
          <span>Changes save automatically</span>
        )}
      </div>
    </div>
  );
}
