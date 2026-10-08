/**
 * Read a deck from anywhere (a database row, a request body, an old version)
 * into a Deck that renders. Lenient on purpose: a field that no longer fits is
 * trimmed or dropped, never fatal — a deck already sent to someone must keep
 * opening. Strict only where it guards the reader: links must be https.
 */

import {
  BINDINGS,
  DECK_VERSION,
  DEFAULT_THEME,
  LAYOUTS,
  LIMITS,
  type Bar,
  type Binding,
  type Column,
  type Deck,
  type Layout,
  type Slide,
  type Stat,
  type Theme,
} from './types';

type Raw = Record<string, unknown>;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

function list<T>(value: unknown, max: number, read: (item: unknown) => T | undefined): T[] {
  return Array.isArray(value)
    ? value
        .map(read)
        .filter((x): x is T => x !== undefined)
        .slice(0, max)
    : [];
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const HEX = /^#[0-9a-f]{6}$/i;

function readTheme(raw: unknown): Theme {
  const r = (raw ?? {}) as Raw;
  return {
    mode: r.mode === 'light' ? 'light' : 'dark',
    accent: typeof r.accent === 'string' && HEX.test(r.accent) ? r.accent : DEFAULT_THEME.accent,
  };
}

function readStat(item: unknown): Stat | undefined {
  const r = (item ?? {}) as Raw;
  const value = text(r.value, LIMITS.statValue);
  const label = text(r.label, LIMITS.statLabel);
  return value && label ? { value, label } : undefined;
}

function readBar(item: unknown): Bar | undefined {
  const r = (item ?? {}) as Raw;
  const label = text(r.label, 24);
  const value =
    typeof r.value === 'number' && Number.isFinite(r.value) && r.value >= 0 ? r.value : undefined;
  return label && value !== undefined ? { label, value } : undefined;
}

function readColumn(item: unknown): Column | undefined {
  const r = (item ?? {}) as Raw;
  const heading = text(r.heading, LIMITS.kicker);
  const items = list(r.items, LIMITS.columnItems, i => text(i, LIMITS.point));
  return heading ? { heading, items } : undefined;
}

let counter = 0;
/** A short id, unique enough within one deck. */
export function newSlideId(): string {
  counter = (counter + 1) % 1_000_000;
  return `s${Date.now().toString(36)}${counter.toString(36)}`;
}

export function normalizeSlide(raw: unknown): Slide | undefined {
  const r = (raw ?? {}) as Raw;
  const layout = LAYOUTS.includes(r.layout as Layout) ? (r.layout as Layout) : undefined;
  const title = text(r.title, LIMITS.title);
  if (!layout || !title) {
    return undefined;
  }
  const slide: Slide = {
    id: text(r.id, 40) ?? newSlideId(),
    layout,
    title,
  };
  const kicker = text(r.kicker, LIMITS.kicker);
  const body = text(r.body, LIMITS.body);
  const sources = text(r.sources, LIMITS.sources);
  const notes = text(r.notes, LIMITS.notes);
  const points = list(r.points, LIMITS.points, i => text(i, LIMITS.point));
  const stats = list(r.stats, LIMITS.stats, readStat);
  const bars = list(r.bars, LIMITS.bars, readBar);
  const columns = list(r.columns, LIMITS.columns, readColumn);
  if (kicker) {
    slide.kicker = kicker;
  }
  if (body) {
    slide.body = body;
  }
  if (points.length) {
    slide.points = points;
  }
  if (stats.length) {
    slide.stats = stats;
  }
  if (bars.length) {
    slide.bars = bars;
  }
  if (columns.length) {
    slide.columns = columns;
  }
  if (isHttpsUrl(r.image)) {
    slide.image = r.image;
  }
  const caption = text(r.imageCaption, 80);
  if (caption) {
    slide.imageCaption = caption;
  }
  const action = (r.action ?? {}) as Raw;
  const actionLabel = text(action.label, 60);
  if (
    actionLabel &&
    (isHttpsUrl(action.href) || /^mailto:[^\s@]+@[^\s@]+$/.test(String(action.href)))
  ) {
    slide.action = { label: actionLabel, href: String(action.href) };
  }
  if (sources) {
    slide.sources = sources;
  }
  if (notes) {
    slide.notes = notes;
  }
  if (BINDINGS.includes(r.bind as Binding)) {
    slide.bind = r.bind as Binding;
  }
  return slide;
}

export function normalizeDeck(raw: unknown): Deck | null {
  const r = (raw ?? {}) as Raw;
  const slides = list(r.slides, LIMITS.slides, normalizeSlide);
  if (slides.length === 0) {
    return null;
  }
  // Ids must be unique: a duplicate (a pasted slide) gets a fresh one.
  const seen = new Set<string>();
  for (const slide of slides) {
    if (seen.has(slide.id)) {
      slide.id = newSlideId();
    }
    seen.add(slide.id);
  }
  return {
    version: DECK_VERSION,
    title: text(r.title, LIMITS.title) ?? slides[0]!.title.replace(/\*/g, ''),
    theme: readTheme(r.theme),
    slides,
  };
}
