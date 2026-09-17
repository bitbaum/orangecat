'use client';

/**
 * SettingsPreferencesSection — display preferences on the account settings page.
 *
 * Two values, one save. They live in profiles.currency and profiles.date_format
 * (the SSOTs read by useDisplayCurrency and useDisplayDate platform-wide) and
 * are written through the same PUT /api/profile path as the profile editor —
 * this is a second door to the same columns, not a second copy of the data.
 *
 * `date_format` defaults to 'auto', which is not a format but the absence of a
 * choice: the format is then inferred from where the person says they are, so
 * someone who moves country gets the local convention without coming back here.
 */

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Coins, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
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
import { logger } from '@/utils/logger';

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
  const [isSaving, setIsSaving] = useState(false);

  // Adopt the profile values once they load; don't clobber an in-progress pick.
  useEffect(() => {
    setCurrency(prev => (prev === PLATFORM_DEFAULT_CURRENCY ? savedCurrency : prev));
  }, [savedCurrency]);

  useEffect(() => {
    setDateFormat(prev => (prev === 'auto' ? savedDateFormat : prev));
  }, [savedDateFormat]);

  const hasChanges = currency !== savedCurrency || dateFormat !== savedDateFormat;

  const handleSave = useCallback(async () => {
    if (!profile?.username) {
      toast.error('Profile still loading — try again in a moment.');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(API_ROUTES.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profile.username, currency, date_format: dateFormat }),
      });
      if (!res.ok) {
        throw new Error(`save failed (${res.status})`);
      }
      await fetchProfile();
      toast.success('Display preferences saved');
    } catch (err) {
      logger.error('Display preference save failed', err, 'Settings');
      toast.error('Could not save your preferences. Try again.');
    } finally {
      setIsSaving(false);
    }
  }, [currency, dateFormat, profile?.username, fetchProfile]);

  return (
    <div className="border-t border-subtle pt-10">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-fg-primary">
        <Coins className="mr-2 h-6 w-6 text-fg-secondary" />
        Display Currency
      </h3>
      <p className="mb-6 text-fg-secondary">
        Amounts across OrangeCat show in this currency (converted from BTC). Bitcoin stays the
        canonical unit underneath.
      </p>
      <div className="flex max-w-md items-center gap-3">
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className="w-48">
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

      <h3 className="mb-4 mt-10 flex items-center text-lg font-semibold text-fg-primary">
        <CalendarDays className="mr-2 h-6 w-6 text-fg-secondary" />
        Date Format
      </h3>
      <p className="mb-6 text-fg-secondary">
        How dates read across OrangeCat. Left on automatic, this follows the country on your profile
        — most of the world writes the day first.
      </p>
      <div className="flex max-w-md items-center gap-3">
        <Select
          value={dateFormat}
          onValueChange={value => setDateFormat(value as DateFormatPreference)}
        >
          <SelectTrigger className="w-64">
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

      <div className="mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="px-5 py-2"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            'Save preferences'
          )}
        </Button>
      </div>
    </div>
  );
}
