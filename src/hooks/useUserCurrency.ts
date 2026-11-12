/**
 * USER CURRENCY HOOK
 *
 * Provides the user's preferred currency from their profile/settings.
 * Falls back to PLATFORM_DEFAULT_CURRENCY ('CHF') if not set.
 *
 * Created: 2025-01-03
 * Last Modified: 2026-01-04
 * Last Modified Summary: Updated comment to reflect actual fallback to CHF
 */

'use client';

import { useAuthStore } from '@/stores/auth';
import { PLATFORM_DEFAULT_CURRENCY, isSupportedCurrency } from '@/config/currencies';
import type { Currency } from '@/types/settings';

/**
 * Returns the user's preferred display currency.
 * Falls back to PLATFORM_DEFAULT_CURRENCY ('CHF') if not set or invalid.
 */
export function useUserCurrency(): Currency {
  const profile = useAuthStore(state => state.profile);

  // Check if profile has a currency setting
  // Note: currency might be in profile or in settings depending on implementation
  const profileCurrency = (profile as Record<string, unknown> | null)?.currency as
    string | undefined;

  // SATS is a Lightning protocol unit, not a user-facing display currency — we
  // never display amounts in sats. Honor any legacy SATS preference as the
  // default (CHF) instead.
  if (
    profileCurrency &&
    isSupportedCurrency(profileCurrency) &&
    profileCurrency.toUpperCase() !== 'SATS'
  ) {
    return profileCurrency as Currency;
  }

  // Default to CHF as the platform is Swiss-focused
  return PLATFORM_DEFAULT_CURRENCY;
}
