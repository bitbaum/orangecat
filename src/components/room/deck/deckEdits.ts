/**
 * The edits an owner makes to a deck, as pure functions — so the editor stays
 * thin and each edit is testable. A new or duplicated slide gets a fresh id;
 * an id never changes once given (comments and deep links anchor to it).
 */

import { LIMITS, newSlideId, type Deck, type Layout, type Slide } from '@bitbaum/deckkit';

export const LAYOUT_LABELS: Record<Layout, string> = {
  cover: 'Cover',
  statement: 'Statement',
  points: 'Points',
  numbers: 'Numbers',
  chart: 'Chart',
  compare: 'Before / after',
  columns: 'Columns',
  image: 'Screenshot',
  closing: 'Closing',
};

/** A blank slide of a layout, with placeholder text that says what to write. */
export function blankSlide(layout: Layout): Slide {
  const base = {
    id: newSlideId(),
    layout,
    kicker: LAYOUT_LABELS[layout],
    title: 'One claim, stated as a sentence.',
  };
  switch (layout) {
    case 'points':
      return { ...base, points: ['Lead: the first reason', 'Lead: the second reason'] };
    case 'numbers':
      return { ...base, stats: [{ value: '0', label: 'What it counts' }] };
    case 'chart':
      return {
        ...base,
        bars: [
          { label: 'Start', value: 1 },
          { label: 'Now', value: 2 },
        ],
      };
    case 'compare':
      return {
        ...base,
        columns: [
          { heading: 'Before', items: ['…'] },
          { heading: 'After', items: ['…'] },
        ],
      };
    case 'columns':
      return {
        ...base,
        columns: [
          { heading: 'Now', items: ['…'] },
          { heading: 'Next', items: ['…'] },
        ],
      };
    default:
      return base;
  }
}

export function updateSlide(deck: Deck, index: number, patch: Partial<Slide>): Deck {
  return {
    ...deck,
    slides: deck.slides.map((s, i) => (i === index ? { ...s, ...patch, id: s.id } : s)),
  };
}

export function insertSlide(
  deck: Deck,
  after: number,
  slide: Slide
): { deck: Deck; index: number } {
  if (deck.slides.length >= LIMITS.slides) {
    return { deck, index: after };
  }
  const slides = [...deck.slides];
  slides.splice(after + 1, 0, slide);
  return { deck: { ...deck, slides }, index: after + 1 };
}

export function duplicateSlide(deck: Deck, index: number): { deck: Deck; index: number } {
  const slide = deck.slides[index];
  return slide
    ? insertSlide(deck, index, { ...structuredClone(slide), id: newSlideId() })
    : { deck, index };
}

export function removeSlide(deck: Deck, index: number): { deck: Deck; index: number } {
  if (deck.slides.length <= 1) {
    return { deck, index };
  }
  const slides = deck.slides.filter((_, i) => i !== index);
  return { deck: { ...deck, slides }, index: Math.min(index, slides.length - 1) };
}

export function moveSlide(deck: Deck, index: number, by: -1 | 1): { deck: Deck; index: number } {
  const to = index + by;
  if (to < 0 || to >= deck.slides.length) {
    return { deck, index };
  }
  const slides = [...deck.slides];
  const [slide] = slides.splice(index, 1);
  slides.splice(to, 0, slide!);
  return { deck: { ...deck, slides }, index: to };
}

/** Lines of a textarea ⇄ a list. Empty lines are dropped. */
export const toLines = (items: string[] | undefined) => (items ?? []).join('\n');
export const fromLines = (text: string) =>
  text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

/** "value | label" lines ⇄ stats; "label | value" lines ⇄ bars. */
export function toPairs<T>(
  items: T[] | undefined,
  left: (t: T) => string,
  right: (t: T) => string
): string {
  return (items ?? []).map(t => `${left(t)} | ${right(t)}`).join('\n');
}
export function fromPairs(text: string): [string, string][] {
  return fromLines(text)
    .map(line => line.split('|').map(p => p.trim()))
    .filter(parts => parts.length >= 2 && parts[0] && parts[1])
    .map(parts => [parts[0]!, parts.slice(1).join(' | ')]);
}
