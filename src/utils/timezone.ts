/**
 * Time zones — what wall-clock time a place keeps, and converting to it.
 *
 * An event at a bar in Landquart at 22:00 is 22:00 in Landquart, whoever reads
 * it and wherever the server runs. Two things went wrong without this file:
 *   - pages formatted event times in the SERVER's zone (UTC on the box), so a
 *     22:00 Zurich night read "8:00 PM";
 *   - a time written without an offset ("2026-10-09T22:00", from the form or
 *     the Cat) was stored as UTC by Postgres, so the night moved by two hours.
 *
 * No dependency: Intl knows every IANA zone and its offsets, which is all
 * converting needs. What Intl cannot say is which zone a PLACE is in;
 * `timeZoneForPlace` answers that from the country, and from the longitude in
 * the few large countries that span several zones. Where it cannot be sure it
 * returns null rather than guess.
 */

import { COUNTRY_ZONE, MULTI_ZONE_BANDS } from '@/config/time-zones';
import { APP_LOCALE } from '@/utils/locale';

/** Whether the runtime knows a zone name ("Europe/Zurich" yes, "CET+1" no). */
export function isValidTimeZone(zone: unknown): zone is string {
  if (typeof zone !== 'string' || !zone.trim()) {
    return false;
  }
  try {
    new Intl.DateTimeFormat(APP_LOCALE, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * The zone a place keeps, from its country and (for countries spanning
 * several) its longitude. Null when unknown — the caller decides the fallback.
 */
export function timeZoneForPlace(place: {
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): string | null {
  const cc = place.countryCode?.trim().toUpperCase();
  if (!cc) {
    return null;
  }
  if (COUNTRY_ZONE[cc]) {
    return COUNTRY_ZONE[cc];
  }
  if (cc === 'US' && typeof place.latitude === 'number') {
    if (place.latitude > 51) {
      return 'America/Anchorage';
    }
    if (place.latitude < 23 && (place.longitude ?? 0) < -150) {
      return 'Pacific/Honolulu';
    }
  }
  const bands = MULTI_ZONE_BANDS[cc];
  if (!bands || typeof place.longitude !== 'number' || !Number.isFinite(place.longitude)) {
    return null;
  }
  let zone: string | null = null;
  for (const [from, name] of bands) {
    if (place.longitude >= from) {
      zone = name;
    }
  }
  return zone ?? bands[0]?.[1] ?? null;
}

/** Whether an ISO string already says which instant it means. */
export function hasUtcOffset(value: string): boolean {
  return /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value.trim());
}

/** Minutes the zone is ahead of UTC at that instant (Zurich in summer: 120). */
export function zoneOffsetMinutes(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * "2026-10-09T22:00" in Europe/Zurich → "2026-10-09T20:00:00.000Z".
 * A value that already carries an offset is returned as that instant, so the
 * caller can pass anything a form or a model produced. Null when unparseable.
 */
export function wallTimeToUtc(value: string, zone: string): string | null {
  const text = value.trim();
  if (hasUtcOffset(text)) {
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) {
    return null;
  }
  const [, y = '', mo = '', d = '', h = '0', mi = '0', s = '0'] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (Number.isNaN(naive)) {
    return null;
  }
  // Two passes settle the daylight-saving edge: the offset at the guess can
  // differ from the offset at the answer by the one hour that changed.
  let instant = naive - zoneOffsetMinutes(new Date(naive), zone) * 60000;
  instant = naive - zoneOffsetMinutes(new Date(instant), zone) * 60000;
  return new Date(instant).toISOString();
}

/** Format an instant as the wall-clock time of a zone. */
export function formatInZone(
  value: string | number | Date,
  zone: string,
  options: Intl.DateTimeFormatOptions,
  locale = APP_LOCALE
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: isValidTimeZone(zone) ? zone : 'UTC',
  }).format(date);
}

/**
 * An instant as the wall-clock value a `datetime-local` input takes
 * ("2026-10-09T22:00"), in a zone. The inverse of `wallTimeToUtc`. A value
 * without an offset is already wall time and is only trimmed to minutes.
 * Empty string when unparseable.
 */
export function instantToWallTime(value: string, zone: string): string {
  const text = value.trim();
  if (!hasUtcOffset(text)) {
    const m = text.match(/^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/);
    return m ? m[0].replace(' ', 'T') : '';
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: isValidTimeZone(zone) ? zone : 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map(p => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** The zone this browser keeps, or UTC where it cannot say (the server). */
export function browserTimeZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(zone) ? zone : 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Every IANA zone the runtime knows, for a picker. */
export function supportedTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] };
  const zones = intl.supportedValuesOf?.('timeZone') ?? Object.values(COUNTRY_ZONE);
  return Array.from(new Set(['UTC', ...zones])).sort();
}

/** "Zurich time", "New York time", "UTC" — which clock the times are on. */
export function zoneLabel(zone: string): string {
  if (zone === 'UTC') {
    return 'UTC';
  }
  const city = zone.split('/').pop() ?? zone;
  return `${city.replace(/_/g, ' ')} time`;
}
