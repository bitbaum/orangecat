/**
 * The one figure an entity's share card states, and the picture it shows.
 *
 * Only what the row says, in the words of its own page: the price the seller
 * set, the goal the cause or offering is raising toward, the date and place of
 * an event. Never an amount raised, a count, a rate or a promise: the card is
 * cached for an hour and travels for weeks, and a stale "CHF 40 of 5,000" is a
 * claim the page no longer makes.
 *
 * Amounts stay in the currency the maker set them in (CHF when none is set,
 * the platform default). Amounts the schema keeps in BTC (research goals,
 * asset prices) are shown in the default currency when there is a rate, else
 * in BTC: the sentence stays true and only loses its comfort.
 */

import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import type { EntityType } from '@/config/entity-registry';
import { eventPlaceText } from '@/domain/events/place';
import { eventZone, formatEventDate } from '@/domain/events/time';
import { entityCoverImages } from '@/lib/entities/cover';
import { firstImage } from '@/lib/og/card-parts';
import { formatCurrency } from '@/services/currency/formatting';
import { formatBtcPlain } from '@/services/currency/format-for-user.server';
import { convertBtcToOrNull } from '@/services/currency/rates.server';
import { formatIsoDay } from '@/utils/dates';

type Row = Record<string, unknown>;

const amountOf = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const currencyOf = (row: Row): string =>
  typeof row.currency === 'string' && row.currency ? row.currency : PLATFORM_DEFAULT_CURRENCY;

/** An amount in the row's own currency: "CHF 120.00". */
function money(value: unknown, row: Row): string | null {
  const amount = amountOf(value);
  return amount === null ? null : formatCurrency(amount, currencyOf(row));
}

/** A BTC amount, in the default currency when there is a rate. */
async function btcMoney(value: unknown): Promise<string | null> {
  const amount = amountOf(value);
  if (amount === null) {
    return null;
  }
  const fiat = await convertBtcToOrNull(amount, PLATFORM_DEFAULT_CURRENCY).catch(() => null);
  return fiat === null ? formatBtcPlain(amount) : formatCurrency(fiat, PLATFORM_DEFAULT_CURRENCY);
}

const withLabel = (label: string, value: string | null) => (value ? `${label} ${value}` : null);

function eventFigure(row: Row): string | null {
  const date =
    typeof row.start_date === 'string' && row.start_date
      ? formatEventDate(row.start_date, eventZone(row))
      : null;
  // The city says enough on a card; the full address is on the page.
  const city = typeof row.venue_city === 'string' ? row.venue_city.trim() : '';
  const place = row.is_online ? 'Online' : city || eventPlaceText(row);
  return [date, place].filter(Boolean).join(' · ') || null;
}

function serviceFigure(row: Row): string | null {
  const fixed = money(row.fixed_price, row);
  if (fixed) {
    return fixed;
  }
  const hourly = money(row.hourly_rate, row);
  return hourly ? `${hourly} / hour` : null;
}

/** The card's one figure for this kind of entity, or null when the row has none. */
export async function entityCardFigure(type: EntityType, row: Row): Promise<string | null> {
  switch (type) {
    case 'product':
      return money(row.price, row);
    case 'service':
      return serviceFigure(row);
    case 'cause':
      return withLabel('Goal', money(row.goal_amount, row));
    case 'investment':
      return withLabel('Goal', money(row.target_amount, row));
    case 'loan':
      return money(row.original_amount ?? row.amount, row);
    case 'event':
      return eventFigure(row);
    case 'research':
      return withLabel('Goal', await btcMoney(row.funding_goal_btc));
    case 'asset':
      return row.is_for_sale
        ? withLabel('For sale', await btcMoney(row.sale_price_btc))
        : row.is_for_rent
          ? withLabel('For rent', await btcMoney(row.rental_price_btc))
          : null;
    case 'wishlist':
      return typeof row.event_date === 'string' && row.event_date
        ? formatIsoDay(row.event_date.slice(0, 10))
        : null;
    default:
      return null;
  }
}

/**
 * The entity's own picture: the cover its page's hero and its Discover card
 * show (ENTITY_COVER), so a shared link carries the picture the page leads with.
 */
export function entityCardImage(type: EntityType, row: Row): string | null {
  return firstImage(...entityCoverImages(type, row));
}
