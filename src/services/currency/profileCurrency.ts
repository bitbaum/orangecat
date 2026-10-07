/**
 * The currency a person prices things in — their profile choice, else the
 * platform default. One lookup shared by every writer that must fill a
 * currency column the person did not name (the events form, the Cat).
 */

import { CURRENCY_CODES, PLATFORM_DEFAULT_CURRENCY, type CurrencyCode } from '@/config/currencies';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === 'string' && (CURRENCY_CODES as readonly string[]).includes(v);

export async function getProfileCurrency(
  supabase: AnySupabaseClient,
  userId: string
): Promise<CurrencyCode> {
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('currency')
    .eq('id', userId)
    .maybeSingle();
  return isCurrencyCode(data?.currency) ? data.currency : PLATFORM_DEFAULT_CURRENCY;
}
