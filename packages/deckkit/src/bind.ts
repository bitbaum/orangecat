/**
 * Bound slides are filled from live data at render time, so a deck sent in
 * October still shows November's numbers in November. A binding whose source
 * is absent leaves the slide exactly as written — the deck never breaks
 * because a neighbouring service is down.
 */

import type { Deck, DeckData, Slide } from './types';

export function bindSlide(slide: Slide, data: DeckData): Slide {
  switch (slide.bind) {
    case 'facts':
      return data.facts?.length
        ? { ...slide, stats: data.facts.slice(0, 6), sources: data.factsSource ?? slide.sources }
        : slide;
    case 'pace':
      return data.pace?.bars.length
        ? { ...slide, bars: data.pace.bars, sources: data.pace.caption ?? slide.sources }
        : slide;
    case 'roadmap':
      return data.roadmap?.some(c => c.items.length)
        ? {
            ...slide,
            columns: data.roadmap.filter(c => c.items.length).slice(0, 4),
            sources: data.roadmapSource ?? slide.sources,
          }
        : slide;
    default:
      return slide;
  }
}

export function bindDeck(deck: Deck, data: DeckData): Deck {
  return { ...deck, slides: deck.slides.map(s => bindSlide(s, data)) };
}
