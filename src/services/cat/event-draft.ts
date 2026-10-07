/**
 * The words a person uses for when an event is — "today at 7pm", "Friday
 * 20:30", "heute 19 Uhr" — read as a wall-clock time in the event's zone.
 *
 * Both ways the Cat makes an event need this. The create_event action asks
 * the model for "2026-10-09T22:00" and a weak model, told the date in UTC and
 * asked for a conversion, sometimes passes the words through instead; the
 * draft card asks a second model to fill start_date with no idea what day it
 * is, and a model told never to invent a date leaves the field blank, so the
 * card's Publish failed on "Start date is required" (2026-10-07, "a concert
 * today at 7pm at Rote Fabrik, 1 franc").
 *
 * The output is the wall-clock form the rest of the events code already
 * takes (`resolveEventTimes` → `wallTimeToUtc` turn it into an instant in the
 * venue's zone), so this adds reading, not a second clock. Nothing is
 * invented: words with no time in them give null, and the caller asks.
 */
import { EVENT_TYPES, type EventType } from '@/config/events';
import { isValidTimeZone } from '@/utils/timezone';
import { APP_LOCALE } from '@/utils/locale';
import type { CurrencyCode } from '@/config/currencies';

export type EventDraftContext = {
  now: Date;
  /** The zone the words are read in: the venue's, else the person's, else UTC. */
  zone: string;
  currency: CurrencyCode;
};

/** Already a date the events code reads: ISO, or "YYYY-MM-DD HH:mm". */
export const looksLikeIsoDate = (text: string): boolean => /^\d{4}-\d{2}-\d{2}/.test(text.trim());

type Parts = { y: number; m: number; d: number; wd: number };

function todayIn(instant: Date, zone: string): Parts {
  const f = new Intl.DateTimeFormat(APP_LOCALE, {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(instant)) {
    p[part.type] = part.value;
  }
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Day arithmetic on a calendar date, DST-proof because it never touches a clock. */
function addDays(p: Parts, days: number): { y: number; m: number; d: number } {
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** "19:00", "7pm", "7 p.m.", "19h30", "19 Uhr" — but never "1 CHF" or "2026". */
function readTime(text: string): { h: number; mi: number } | null {
  const re = /\b(\d{1,2})(?:[:.h](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|uhr)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const n = Number(m[1]);
    const mi = m[2] ? Number(m[2]) : 0;
    const suffix = (m[3] ?? '').toLowerCase().replace(/\./g, '');
    const explicit = Boolean(m[2]) || suffix !== '';
    if (!explicit || n > 24 || mi > 59) {
      continue; // a bare number is a price, a count or a year
    }
    let h = n;
    if (suffix.startsWith('p') && h < 12) {
      h += 12;
    }
    if (suffix.startsWith('a') && h === 12) {
      h = 0;
    }
    return { h: h % 24, mi };
  }
  return null;
}

/**
 * Words → "YYYY-MM-DDTHH:mm" in `zone`, or null when the words do not say
 * when. A value that already looks like a date is returned as given.
 * "DD.MM.YYYY HH:mm" (how Switzerland writes it) is read too.
 */
export function parseEventWords(
  text: string | null | undefined,
  ctx: { now: Date; zone: string }
): string | null {
  if (!text || !text.trim()) {
    return null;
  }
  const s = text.trim();
  if (looksLikeIsoDate(s)) {
    return s;
  }
  const zone = isValidTimeZone(ctx.zone) ? ctx.zone : 'UTC';
  const swiss = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\b/.exec(s);
  if (swiss) {
    const time = readTime(s.slice(swiss[0].length));
    if (!time) {
      return null;
    }
    return `${swiss[3]}-${pad(Number(swiss[2]))}-${pad(Number(swiss[1]))}T${pad(time.h)}:${pad(time.mi)}`;
  }
  const lower = s.toLowerCase();
  const today = todayIn(ctx.now, zone);
  let dayOffset: number | null = null;
  if (/\b(today|tonight|this (evening|afternoon|morning)|heute)\b/.test(lower)) {
    dayOffset = 0;
  } else if (/\b(day after tomorrow|übermorgen)\b/.test(lower)) {
    dayOffset = 2;
  } else if (/\b(tomorrow|morgen)\b/.test(lower)) {
    dayOffset = 1;
  } else {
    const wd = WEEKDAYS.findIndex(name =>
      new RegExp(`\\b(${name}|${name.slice(0, 3)})\\b`).test(lower)
    );
    if (wd >= 0) {
      const ahead = (wd - today.wd + 7) % 7;
      // "Wednesday" said on a Wednesday is next week unless "this" is said.
      dayOffset = ahead === 0 && !/\bthis\b/.test(lower) ? 7 : ahead;
    }
  }
  if (dayOffset === null) {
    return null;
  }
  const time = readTime(s);
  if (!time) {
    return null; // "today" alone says no time; the caller asks rather than guesses
  }
  const day = addDays(today, dayOffset);
  return `${day.y}-${pad(day.m)}-${pad(day.d)}T${pad(time.h)}:${pad(time.mi)}`;
}

/** The places the Cat can name a zone for from words alone, without a
 *  geocoder. Short and honest: anywhere else falls back to the person's zone. */
const PLACE_ZONES: Array<[RegExp, string]> = [
  [
    /\b(z[uü]rich|zuerich|bern|basel|gen[eè]ve|geneva|lausanne|luzern|lucerne|winterthur|st\.? ?gallen|lugano|switzerland|schweiz|suisse)\b/i,
    'Europe/Zurich',
  ],
  [
    /\b(berlin|m[uü]nchen|munich|hamburg|k[oö]ln|cologne|frankfurt|germany|deutschland)\b/i,
    'Europe/Berlin',
  ],
  [/\b(wien|vienna|austria|[oö]sterreich)\b/i, 'Europe/Vienna'],
  [/\b(paris|lyon|marseille|france)\b/i, 'Europe/Paris'],
  [/\b(milano|milan|roma|rome|torino|turin|italy|italia)\b/i, 'Europe/Rome'],
  [/\b(london|manchester|edinburgh|united kingdom|england)\b/i, 'Europe/London'],
  [/\b(amsterdam|rotterdam|netherlands|nederland)\b/i, 'Europe/Amsterdam'],
  [/\b(lisboa|lisbon|porto|portugal)\b/i, 'Europe/Lisbon'],
  [/\b(madrid|barcelona|spain|espa[nñ]a)\b/i, 'Europe/Madrid'],
  [/\b(new york|nyc|boston|miami|toronto|montr[eé]al)\b/i, 'America/New_York'],
  [/\b(san francisco|los angeles|seattle|vancouver)\b/i, 'America/Los_Angeles'],
  [/\b(tokyo|japan)\b/i, 'Asia/Tokyo'],
  [/\b(singapore)\b/i, 'Asia/Singapore'],
];

export function guessTimezone(place: string | null | undefined): string | null {
  if (!place) {
    return null;
  }
  for (const [re, zone] of PLACE_ZONES) {
    if (re.test(place)) {
      return zone;
    }
  }
  return null;
}

const EVENT_TYPE_VALUES = new Set<string>(EVENT_TYPES.map(t => t.value));

/** Words → the table's event_type enum, plus a category where the enum has
 *  no word for it: there is no "concert" type, there is a Music category. */
const KIND_WORDS: Array<[RegExp, { event_type: EventType; category?: string }]> = [
  [
    /\b(concert|konzert|gig|live music|show|dj set|jam)\b/i,
    { event_type: 'concert', category: 'Music' },
  ],
  [/\b(meetup|meet-up|gathering|treffen)\b/i, { event_type: 'meetup' }],
  [/\b(conference|summit|konferenz)\b/i, { event_type: 'conference' }],
  [/\b(workshop|class|course|training|kurs)\b/i, { event_type: 'workshop' }],
  [/\b(party|celebration|fest(?!ival)|feier)\b/i, { event_type: 'party' }],
  [/\b(exhibition|expo|vernissage|ausstellung)\b/i, { event_type: 'exhibition' }],
  [/\b(festival)\b/i, { event_type: 'festival' }],
  [/\b(retreat)\b/i, { event_type: 'retreat' }],
  [/\b(talk|lecture|vortrag|reading|lesung)\b/i, { event_type: 'other', category: 'Education' }],
];

export function classifyEvent(words: string): { event_type: EventType; category?: string } {
  for (const [re, kind] of KIND_WORDS) {
    if (re.test(words)) {
      return kind;
    }
  }
  return { event_type: 'meetup' };
}

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
const num = (v: unknown): number | null => {
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : null;
  }
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^\d.,-]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * The draft card's data, made valid before the person sees it: the model's
 * date words become a wall-clock time, `location` lands in `venue_name`, a
 * `price` lands in `ticket_price` with the currency, and a concert gets a
 * type. Fields the model did not give are left alone — this fixes shape, it
 * does not add facts.
 */
export function normalizeEventDraft(
  data: Record<string, unknown>,
  ctx: EventDraftContext
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  const placeWords = ['venue_name', 'venue_address', 'venue_city', 'venue_country', 'location']
    .map(k => str(data[k]))
    .filter(Boolean)
    .join(', ');
  const zone =
    [str(data.timezone), guessTimezone(placeWords), ctx.zone].find(isValidTimeZone) ?? 'UTC';
  out.timezone = zone;
  if (str(data.location) && !str(data.venue_name)) {
    out.venue_name = str(data.location);
  }
  delete out.location;
  for (const key of ['start_date', 'end_date'] as const) {
    const words = str(data[key]);
    if (words) {
      out[key] = parseEventWords(words, { now: ctx.now, zone }) ?? words;
    }
  }
  const price = num(data.price) ?? num(data.ticket_price);
  delete out.price;
  if (price !== null && price > 0) {
    out.ticket_price = price;
    out.is_free = false;
    out.currency = str(data.currency)?.toUpperCase() ?? ctx.currency;
  } else if (price !== null && typeof data.is_free !== 'boolean') {
    out.is_free = true;
  }
  if (!str(data.event_type) || !EVENT_TYPE_VALUES.has(String(data.event_type))) {
    const kind = classifyEvent([str(data.title), str(data.description)].filter(Boolean).join(' '));
    out.event_type = kind.event_type;
    if (kind.category && !str(data.category)) {
      out.category = kind.category;
    }
  }
  return out;
}

/**
 * What the draft model must be told so "today" and "7pm" mean something: the
 * day, in the person's zone, and the currency prices are in. Appended to
 * the description it drafts from.
 */
export function withEventDayContext(description: string, ctx: EventDraftContext): string {
  const zone = isValidTimeZone(ctx.zone) ? ctx.zone : 'UTC';
  const p = todayIn(ctx.now, zone);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    p.wd
  ];
  return `${description}\n\n(Context: today is ${weekday} ${p.y}-${pad(p.m)}-${pad(p.d)} in ${zone}; prices are in ${ctx.currency}. Write start_date as YYYY-MM-DDTHH:mm, wall-clock at the venue.)`;
}

/* ── Facts from the words, with no model at all ───────────────────────────── */

const CURRENCY_WORDS: Array<[RegExp, string]> = [
  [/^(chf|fr\.?|sfr|franken|francs?|rappen)$/i, 'CHF'],
  [/^(eur|€|euros?)$/i, 'EUR'],
  [/^(usd|\$|dollars?)$/i, 'USD'],
  [/^(gbp|£|pounds?)$/i, 'GBP'],
  [/^(btc|bitcoin|sats?)$/i, 'BTC'],
];

const UNIT = '(chf|eur|usd|gbp|btc|fr\\.?|sfr|franken|francs?|euros?|dollars?|pounds?|€|\\$|£)';
const PRICE_AFTER = new RegExp(`(\\d+(?:[.,]\\d{1,2})?)\\s*${UNIT}(?![a-z])`, 'i');
const PRICE_BEFORE = new RegExp(`${UNIT}\\s*(\\d+(?:[.,]\\d{1,2})?)`, 'i');

/** "1 CHF", "CHF 1", "Eintritt: 1 Fr.", "€5". A bare "20.-" has no unit and is not read. */
export function readPrice(text: string): { amount: number; currency: string | null } | null {
  const a = PRICE_AFTER.exec(text);
  const b = PRICE_BEFORE.exec(text);
  const hit =
    a && (!b || a.index <= b.index) ? { n: a[1], u: a[2] } : b ? { n: b[2], u: b[1] } : null;
  if (!hit) {
    return null;
  }
  const amount = parseFloat(hit.n.replace(',', '.'));
  if (!Number.isFinite(amount)) {
    return null;
  }
  const currency = CURRENCY_WORDS.find(([re]) => re.test(hit.u))?.[1] ?? null;
  return { amount, currency };
}

const VENUE_RE =
  /\b(?:in der|in dem|im|in the|at the|at|bei|beim|@)\s+([A-ZÄÖÜ][^.,;:!?\n]*?)(?=\s*(?:[.,;:!?\n]|$)|\s+(?:um|ab|at|from|von|beginn|start|doors|tickets?|eintritt|preis|price)\b)/i;

/**
 * "in der Roten Fabrik", "at Rote Fabrik, Zürich", "im Kaufleuten", "@ Hive".
 * A name starts with a capital and runs to the next punctuation or time word.
 * Nothing is geocoded here; the venue code does that when the form is saved.
 */
export function readVenue(text: string): string | null {
  const m = VENUE_RE.exec(text);
  if (!m) {
    return null;
  }
  const name = m[1].trim().replace(/\s+/g, ' ');
  // "at 7pm" is not a place.
  return /^\d/.test(name) || name.length < 3 ? null : name;
}

/** Words a person uses to say nobody pays. */
const FREE_RE = /\b(free|gratis|kostenlos|frei|umsonst|no charge|free entry|eintritt frei)\b/i;

/**
 * Everything the words alone can state about an event, as form fields: when,
 * where, what it costs, what kind. The model adds the prose (a title, a
 * description); it never has to be the one that reads "19:00" or "1 CHF",
 * and when it does not answer at all the form still fills with the facts.
 * Only what the words say: a sentence with no time sets no start_date.
 */
export function eventFactsFromWords(text: string, ctx: EventDraftContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const venue = readVenue(text);
  if (venue) {
    out.venue_name = venue;
  }
  const zone = [guessTimezone(text), ctx.zone].find(isValidTimeZone) ?? 'UTC';
  const start = parseEventWords(text, { now: ctx.now, zone });
  if (start) {
    out.start_date = start;
    out.timezone = zone;
  }
  const price = readPrice(text);
  if (price && price.amount > 0) {
    out.ticket_price = price.amount;
    out.is_free = false;
    out.currency = price.currency ?? ctx.currency;
  } else if (FREE_RE.test(text) || (price && price.amount === 0)) {
    out.is_free = true;
  }
  const kind = classifyEvent(text);
  out.event_type = kind.event_type;
  if (kind.category) {
    out.category = kind.category;
  }
  return out;
}

/** The keys the words decide. A model's guess never overrides a stated fact. */
export const EVENT_FACT_KEYS = [
  'start_date',
  'timezone',
  'ticket_price',
  'is_free',
  'currency',
  'event_type',
  'category',
  'venue_name',
] as const;

/** The first clause of the words, capped — a title the person edits, not one
 *  invented for them. Mirrors the draft card's fallback. */
export function titleFromWords(text: string): string {
  const first =
    text
      .trim()
      .split(/[.!?\n]/)[0]
      ?.trim() ?? '';
  return first.length > 70 ? `${first.slice(0, 70).trimEnd()}…` : first;
}
