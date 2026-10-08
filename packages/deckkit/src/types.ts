/**
 * A deck is DATA. How it looks is a function of that data and a theme; editing
 * a deck is editing this structure, never HTML. That is the whole difference
 * from the hand-written decks this replaces (evig public/presentations/*):
 * those could only be changed by a developer, drifted apart in their copied
 * engines, and carried numbers that went stale the day they were typed.
 *
 * Every slide states ONE claim as its title — "Kein Prototyp — eine laufende
 * Plattform.", not "Technologie". A deck is usually read alone, from a link,
 * so each slide must stand without a speaker. Wrap a word in *asterisks* to
 * set it in the accent colour; use it once per slide, if at all.
 */

export const DECK_VERSION = 1 as const;

export const LAYOUTS = [
  'cover',
  'statement',
  'points',
  'numbers',
  'chart',
  'compare',
  'columns',
  'image',
  'closing',
] as const;
export type Layout = (typeof LAYOUTS)[number];

/** What a slide can be bound to, so its numbers are read at render time and never go stale. */
export const BINDINGS = ['facts', 'pace', 'roadmap'] as const;
export type Binding = (typeof BINDINGS)[number];

export interface Stat {
  value: string;
  label: string;
}

export interface Bar {
  label: string;
  value: number;
}

export interface Column {
  heading: string;
  items: string[];
}

export interface Slide {
  /** Stable across reordering — deep links and comments anchor to it, never to the position. */
  id: string;
  layout: Layout;
  /** The small label above the title (mono, uppercase). */
  kicker?: string;
  /** The claim. `*word*` = accent. */
  title: string;
  /** A sentence or two under the title (statement, cover, closing, image). */
  body?: string;
  /** points: 2–6 lines. A line "Lead: rest" sets "Lead" in bold. */
  points?: string[];
  /** numbers */
  stats?: Stat[];
  /** chart */
  bars?: Bar[];
  /** compare: two columns (before / after, them / us); columns: up to four. */
  columns?: Column[];
  /** image: an https URL, shown in a browser frame with `imageCaption` as its address line. */
  image?: string;
  imageCaption?: string;
  /** closing: the one thing to do next. */
  action?: { label: string; href: string };
  /** Where the slide's facts come from. A claim without one is an assertion. */
  sources?: string;
  /** For whoever presents it. Never shown to a reader on their own. */
  notes?: string;
  /** Filled from live data at render time instead of from the fields above. */
  bind?: Binding;
}

export interface Theme {
  mode: 'dark' | 'light';
  /** One accent, hex. */
  accent: string;
}

export interface Deck {
  version: typeof DECK_VERSION;
  title: string;
  theme: Theme;
  slides: Slide[];
}

/** Live data a bound slide reads. Every field optional: an absent source leaves the slide as written. */
export interface DeckData {
  facts?: Stat[];
  factsSource?: string;
  pace?: { bars: Bar[]; caption?: string };
  roadmap?: Column[];
  roadmapSource?: string;
}

export const LIMITS = {
  slides: 40,
  kicker: 60,
  title: 140,
  body: 420,
  points: 6,
  point: 180,
  stats: 6,
  statValue: 24,
  statLabel: 60,
  bars: 16,
  columns: 4,
  columnItems: 6,
  sources: 240,
  notes: 2000,
} as const;

export const DEFAULT_THEME: Theme = { mode: 'dark', accent: '#ff5c00' };
