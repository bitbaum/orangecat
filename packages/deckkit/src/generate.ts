/**
 * Draft a deck from what a project already says about itself. Deterministic:
 * no model, no cost, nothing invented — every word comes from the source, and
 * where the source has no claim the slide says something true and plain rather
 * than something impressive. The owner edits from there.
 *
 * The arc is the one investors read in (and the one evig's decks converged
 * on): what it is → the problem → the solution → is it real → how it ships →
 * the owner's own sections → the numbers → what comes next → the ask.
 */

import { bindDeck } from './bind';
import { normalizeDeck, newSlideId } from './normalize';
import { firstSentence, paragraphs } from './text';
import {
  DECK_VERSION,
  DEFAULT_THEME,
  type Column,
  type Deck,
  type DeckData,
  type Slide,
  type Stat,
} from './types';

export interface DeckSource {
  name: string;
  headline?: string | null;
  website?: string | null;
  identity?: { problem?: string | null; solution?: string | null; vision?: string | null };
  /** The owner's own written sections, in order. */
  sections?: { title: string; body: string }[];
  /** Numbers the owner typed, and when they were counted. */
  numbers?: Stat[];
  numbersAsOf?: string | null;
  contactEmail?: string | null;
  /** "October 2026" — shown on the cover. */
  dateLabel?: string;
}

/** Statement slide from a paragraph: first sentence as the claim, the next one or two as body. */
function statement(kicker: string, text: string): Slide {
  const sentences = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [text];
  return {
    id: newSlideId(),
    layout: 'statement',
    kicker,
    title: firstSentence(sentences[0] ?? text, 140),
    body: sentences.slice(1, 3).join(' ').trim().slice(0, 400) || undefined,
  };
}

function sectionSlide(section: { title: string; body: string }): Slide | null {
  const paras = paragraphs(section.body);
  if (paras.length === 0) {
    return null;
  }
  if (paras.length === 1) {
    return statement(section.title, paras[0]!);
  }
  return {
    id: newSlideId(),
    layout: 'points',
    kicker: section.title,
    title: firstSentence(paras[0]!, 140),
    points: paras.slice(1, 6).map(p => firstSentence(p, 170)),
  };
}

/** A section whose title says it is the ask (or the risks) is kept for its own place in the arc. */
const ASK = /\b(ask|the ask|investment|raise|funding)\b/i;

export function generateDeck(source: DeckSource, data: DeckData = {}): Deck {
  const slides: Slide[] = [];
  const sections = (source.sections ?? []).filter(s => s.body.trim());
  const ask = sections.find(s => ASK.test(s.title));

  slides.push({
    id: newSlideId(),
    layout: 'cover',
    kicker: source.dateLabel ? `Investor deck · ${source.dateLabel}` : 'Investor deck',
    title: source.name,
    body: source.headline ?? undefined,
  });

  if (source.identity?.problem) {
    slides.push(statement('The problem', source.identity.problem));
  }
  if (source.identity?.solution) {
    slides.push(statement('The solution', source.identity.solution));
  }

  if (data.facts?.length) {
    slides.push({
      id: newSlideId(),
      layout: 'numbers',
      kicker: 'Is it real',
      title: 'Live, in the open, and *verifiable*.',
      bind: 'facts',
    });
  }
  if (data.pace?.bars.length) {
    slides.push({
      id: newSlideId(),
      layout: 'chart',
      kicker: 'How it ships',
      title: 'Week by week, in *public*.',
      bind: 'pace',
    });
  }

  for (const section of sections) {
    if (section === ask) {
      continue;
    }
    const slide = sectionSlide(section);
    if (slide) {
      slides.push(slide);
    }
  }

  if (source.numbers?.length) {
    slides.push({
      id: newSlideId(),
      layout: 'numbers',
      kicker: 'The numbers',
      title: 'What exists *today*.',
      stats: source.numbers.slice(0, 6),
      sources: source.numbersAsOf ? `Counted ${source.numbersAsOf}` : undefined,
    });
  }

  if (data.roadmap?.some((c: Column) => c.items.length)) {
    slides.push({
      id: newSlideId(),
      layout: 'columns',
      kicker: 'Roadmap',
      title: 'What comes *next*.',
      bind: 'roadmap',
    });
  }

  if (source.identity?.vision) {
    slides.push(statement('Where it goes', source.identity.vision));
  }

  const askText = ask ? paragraphs(ask.body)[0] : undefined;
  slides.push({
    id: newSlideId(),
    layout: 'closing',
    kicker: ask?.title ?? 'Next',
    title: askText ? firstSentence(askText, 140) : `Talk to us about *${source.name}*.`,
    body: source.website ? source.website.replace(/^https?:\/\//, '') : undefined,
    action: source.contactEmail
      ? { label: source.contactEmail, href: `mailto:${source.contactEmail}` }
      : undefined,
  });

  // Through the normaliser, so a generated deck obeys exactly the limits an edited one does.
  const deck = normalizeDeck({
    version: DECK_VERSION,
    title: source.name,
    theme: DEFAULT_THEME,
    slides,
  });
  return (
    deck ?? {
      version: DECK_VERSION,
      title: source.name,
      theme: DEFAULT_THEME,
      slides: slides.slice(0, 1),
    }
  );
}

export { bindDeck };
