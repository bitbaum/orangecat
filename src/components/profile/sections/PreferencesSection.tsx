'use client';

/**
 * Preferences — a pointer, not a second copy.
 *
 * Currency used to be editable here AND in Settings, two doors to the same
 * column with different labels ("Default Currency" here, "Display currency"
 * there). It lives in Settings → Preferences, beside date format and theme,
 * and saves the moment it changes; the profile editor links to it.
 */

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { PROFILE_SECTIONS } from '../constants';

export function PreferencesSection() {
  return (
    <div className="oc-surface px-4 py-5 sm:px-5 sm:py-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-fg-primary">
        {PROFILE_SECTIONS.PREFERENCES}
      </h3>
      <Link
        href={ROUTES.SETTINGS_PREFERENCES}
        className="mt-2 flex min-h-11 items-center justify-between gap-3 text-sm text-fg-secondary hover:text-fg-primary"
      >
        <span>Currency, date format and theme are in Settings</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Link>
    </div>
  );
}
