/**
 * Date format as a user setting (SSOT).
 *
 * `APP_LOCALE` answers "what language does this interface speak". It is the
 * wrong answer to "how does this person read a date", because those are
 * different questions: an English-speaking interface in Zurich should still
 * write 15.03.2027, and `en-US` writes 3/15/2027. Shipping one constant for
 * both meant every Swiss user read American dates in an app whose default
 * currency is CHF.
 *
 * So: a stored preference, with a sensible guess when there isn't one.
 *
 * The guess is deliberately built only from values the person actually SET.
 * `profiles.currency` is nullable and `useUserCurrency` falls back to CHF, so
 * treating an unset currency as "CHF, therefore Swiss, therefore day-first"
 * would silently reformat dates for every user who never opened settings.
 * A rung with no stored value is skipped, not defaulted.
 */

/**
 * What a person can pick, as a value — the zod enum and the settings picker
 * both read this, and the migration's CHECK constraint mirrors it. A test
 * asserts the SQL and this list still agree, because a constraint that drifts
 * from its schema rejects a value the UI happily offers.
 */
export const DATE_FORMAT_PREFERENCES = ['auto', 'day-first', 'month-first', 'iso'] as const;

/** What a person picked, or `auto` to keep inferring as their profile changes. */
export type DateFormatPreference = (typeof DATE_FORMAT_PREFERENCES)[number];

/** The concrete formats we can render. `auto` resolves to one of these. */
export type DateFormat = Exclude<DateFormatPreference, 'auto'>;

/**
 * Each format is named by what it LOOKS like, and carries both spellings of it.
 *
 * `locale` is for `toLocaleDateString`; it is an implementation detail of the
 * format, not a language choice — `sv-SE` is here because it renders ISO-8601,
 * not because anything is in Swedish.
 *
 * `pattern` is for date-fns, and it is not optional. Most dates in this app are
 * NOT rendered through `toLocaleDateString`: they go through `src/utils/dates.ts`
 * with the pattern written out by hand — `'MMM d, yyyy'` and `'h:mm a'`, month
 * first and a 12-hour clock. Those strings contain no `toLocale` or `Intl` call,
 * so `check:app-locale` never saw them, and the app has been rendering two date
 * dialects with a gate standing over only one of them. A preference that moved
 * only the `toLocale` half would change a minority of the dates on screen and
 * look broken beside the rest.
 */
export const DATE_FORMATS: Record<
  DateFormat,
  { locale: string; label: string; pattern: string; timePattern: string }
> = {
  'day-first': {
    locale: 'en-GB',
    label: 'Day first — 15 Mar 2027',
    pattern: 'd MMM yyyy',
    timePattern: 'HH:mm',
  },
  'month-first': {
    locale: 'en-US',
    label: 'Month first — Mar 15, 2027',
    pattern: 'MMM d, yyyy',
    timePattern: 'h:mm a',
  },
  iso: {
    locale: 'sv-SE',
    label: 'Year first — 2027-03-15',
    pattern: 'yyyy-MM-dd',
    timePattern: 'HH:mm',
  },
};

/**
 * The short list of places that write the month first.
 *
 * Almost everywhere writes the day first; the US is the notable exception,
 * along with a few countries under long US administration. Listing the
 * exceptions rather than the rule keeps this from becoming a 200-row table
 * that drifts.
 */
const MONTH_FIRST_COUNTRIES = new Set(['US', 'PH', 'FM', 'MH', 'PW']);

/** Currencies that imply a month-first country strongly enough to guess from. */
const MONTH_FIRST_CURRENCIES = new Set(['USD', 'PHP']);

export interface DateFormatSignals {
  /** profiles.date_format — what the person chose. */
  preference?: DateFormatPreference | null;
  /** profiles.location_country — an ISO 3166-1 alpha-2 code. */
  locationCountry?: string | null;
  /** profiles.currency — only meaningful when actually stored. */
  currency?: string | null;
  /** profiles.language — a BCP-47 tag, e.g. 'en-US'. */
  language?: string | null;
}

/**
 * Resolve the format to render in.
 *
 * Order is "what they said" → "where they are" → "what they spend" → "how they
 * write". Every rung is skipped when its value is absent, and the last resort
 * is day-first because that is what most of the world — and the platform's
 * Swiss-majority audience — reads.
 */
export function resolveDateFormat(signals: DateFormatSignals = {}): DateFormat {
  const { preference, locationCountry, currency, language } = signals;

  if (preference && preference !== 'auto') {
    return preference;
  }

  const country = locationCountry?.trim().toUpperCase();
  if (country && country.length === 2) {
    return MONTH_FIRST_COUNTRIES.has(country) ? 'month-first' : 'day-first';
  }

  const code = currency?.trim().toUpperCase();
  if (code) {
    return MONTH_FIRST_CURRENCIES.has(code) ? 'month-first' : 'day-first';
  }

  // A region subtag is a claim about place ('en-US'), a bare language is not
  // ('en' says nothing about how you write a date).
  const region = language?.trim().split(/[-_]/)[1]?.toUpperCase();
  if (region && region.length === 2) {
    return MONTH_FIRST_COUNTRIES.has(region) ? 'month-first' : 'day-first';
  }

  return 'day-first';
}

/** The locale string to hand `toLocaleDateString` and friends. */
export function resolveDateLocale(signals: DateFormatSignals = {}): string {
  return DATE_FORMATS[resolveDateFormat(signals)].locale;
}

/** Options for the settings picker, `auto` first. */
export const dateFormatSelectOptions: Array<{ value: DateFormatPreference; label: string }> = [
  { value: 'auto', label: 'Automatic — match my location' },
  ...(Object.keys(DATE_FORMATS) as DateFormat[]).map(value => ({
    value,
    label: DATE_FORMATS[value].label,
  })),
];
