/**
 * An amount of Bitcoin, worded the way its reader counts: in their own
 * currency (profile choice, else the platform default), never as a bare BTC
 * decimal. For text the server writes on someone's behalf — a notification, an
 * email — where no hook can do it for them in the browser.
 *
 * With no exchange rate it falls back to BTC rather than guess a figure: the
 * sentence stays true and only loses its comfort.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { CURRENCY_METADATA } from '@/config/currencies';
import { getProfileCurrency } from './profileCurrency';
import { convertBtcToOrNull } from './rates.server';
import { formatCurrency } from './formatting';

const BTC_DECIMALS = CURRENCY_METADATA.BTC.precision;

export function formatBtcPlain(amountBtc: number): string {
  return `${Number(amountBtc.toFixed(BTC_DECIMALS))} BTC`;
}

export async function formatBtcForUser(
  supabase: AnySupabaseClient,
  userId: string,
  amountBtc: number
): Promise<string> {
  try {
    const currency = await getProfileCurrency(supabase, userId);
    if (currency === 'BTC') {
      return formatBtcPlain(amountBtc);
    }
    const converted = await convertBtcToOrNull(amountBtc, currency);
    return converted === null ? formatBtcPlain(amountBtc) : formatCurrency(converted, currency);
  } catch {
    return formatBtcPlain(amountBtc);
  }
}
