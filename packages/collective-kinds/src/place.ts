/**
 * Where a collective — or a person — belongs.
 *
 * Three levels, typed by the person in their own words: a country (ISO 3166-1
 * alpha-2), a region (canton, state, province) and a locality (village,
 * quarter, town). No place registry exists yet; the KEY is what one will map
 * onto. Until then two people who write "Witikon" and "witikon " are in the
 * same place, and two who write "Zürich" and "Zurich" are not — a limitation
 * to fix with a registry, never with a fuzzier key, because a key that merges
 * places quietly is worse than one that splits them visibly.
 *
 * The same shape and the same key rule are used by OrangeCat's civic split
 * (civic_splits.region_key / locality_key are `lower(btrim(x))` in SQL) and by
 * every collective that needs a place. One rule, two implementations, pinned
 * equal by a test on each side.
 */

export interface Place {
  /** ISO 3166-1 alpha-2, uppercase. */
  country_code: string;
  region: string;
  locality: string;
}

/** The stored grouping key for one place name — MUST equal SQL lower(btrim(x)). */
export function placeKey(name: string): string {
  return name.trim().toLowerCase();
}

/** The three keys that identify a place for grouping. */
export function placeKeys(place: Place): {
  country_code: string;
  region_key: string;
  locality_key: string;
} {
  return {
    country_code: place.country_code.trim().toUpperCase(),
    region_key: placeKey(place.region),
    locality_key: placeKey(place.locality),
  };
}

export const PLACE_NAME_MAX = 80;

export function isCountryCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{2}$/.test(value);
}

export type PlaceProblem = 'country_code' | 'region' | 'locality';

/**
 * Why a place is not usable, or null when it is. One reason at a time, in the
 * order a form shows the fields, so a message can point at one input.
 */
export function placeProblem(place: Partial<Place> | null | undefined): PlaceProblem | null {
  if (!place) {
    return 'country_code';
  }
  if (!isCountryCode((place.country_code ?? '').trim().toUpperCase())) {
    return 'country_code';
  }
  for (const field of ['region', 'locality'] as const) {
    const v = place[field]?.trim() ?? '';
    if (v.length < 1 || v.length > PLACE_NAME_MAX) {
      return field;
    }
  }
  return null;
}

/** Trimmed and upper-cased where it should be; null when it is not a place. */
export function normalizePlace(place: Partial<Place> | null | undefined): Place | null {
  if (placeProblem(place)) {
    return null;
  }
  return {
    country_code: place!.country_code!.trim().toUpperCase(),
    region: place!.region!.trim(),
    locality: place!.locality!.trim(),
  };
}

/** "Witikon, Zürich, CH" — the one way a place is written out. */
export function formatPlace(place: Place): string {
  return `${place.locality}, ${place.region}, ${place.country_code}`;
}
