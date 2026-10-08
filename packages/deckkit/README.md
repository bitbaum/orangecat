# @bitbaum/deckkit

Presentations as data. A deck is a list of slides — each a layout plus a few
fields — rendered by one component, so anyone can edit one without touching
code, any app can show one, and numbers bound to live data never go stale.

It replaces the hand-written HTML decks in evig (`public/presentations/*`):
those looked good, but only a developer could change them, every deck carried
its own copy of ~450 lines of engine (the copies drifted), the PDF was a
raster, numbers were typed by hand, and nothing could link to one slide.

## What a good deck is — the rules this package is built around

1. **One claim per slide, and the title states it.** "Kein Prototyp — eine
   laufende Plattform.", not "Technologie". Decks are mostly read alone, from a
   link; each slide must stand without a speaker.
2. **One accent, on one word.** Write `*word*` in a title to set it in the
   accent colour. Once per slide at most.
3. **Short.** A statement is one sentence and one or two under it; points are
   2–6 lines; numbers are 2–6 figures. The limits are enforced (`LIMITS`).
4. **Nothing invented.** Every figure and quote traces to a source — put it in
   `sources`. Prefer a binding (`bind: 'facts' | 'pace' | 'roadmap'`) to a
   typed number: bound slides read live data every time the deck is opened.
5. **Leave out what flatters nobody.** An unflattering screenshot or a number
   that says "0" belongs out of the deck, not explained in it.
6. **Speaker notes come from the slide.** Notes elaborate what the slide says;
   they never smuggle in claims the slide does not make.

## Layouts

| layout      | for                                                          | fields                                             |
| ----------- | ------------------------------------------------------------ | -------------------------------------------------- |
| `cover`     | what it is                                                   | kicker, title, body                                |
| `statement` | one claim (also a quote)                                     | kicker, title, body                                |
| `points`    | a claim and its 2–6 reasons ("Lead: rest" bolds the lead)    | kicker, title, points                              |
| `numbers`   | 2–6 figures                                                  | kicker, title, stats, sources — or `bind: 'facts'` |
| `chart`     | a trend, one series                                          | kicker, title, bars — or `bind: 'pace'`            |
| `compare`   | before / after, them / us (the second column is highlighted) | kicker, title, columns(2)                          |
| `columns`   | up to four groups (a roadmap)                                | kicker, title, columns — or `bind: 'roadmap'`      |
| `image`     | the product, in a browser frame                              | kicker, title, body, image (https), imageCaption   |
| `closing`   | the one thing to do next                                     | kicker, title, body, action                        |

Every slide has a stable `id` (comments and deep links anchor to it, never to
its position) and optional `notes`.

## Use

```ts
import { generateDeck, normalizeDeck, bindDeck } from '@bitbaum/deckkit';
import { DeckPresenter, Slide } from '@bitbaum/deckkit/react';
import '@bitbaum/deckkit/styles.css';

const draft = generateDeck(source, liveData); // a first draft, nothing invented
const deck = normalizeDeck(stored);           // anything stored → a deck that renders
<DeckPresenter deck={bindDeck(deck, liveData)} />  // full screen; #3 = slide 3; prints to PDF
<Slide slide={deck.slides[0]} theme={deck.theme} /> // one slide at any size (previews, thumbnails)
```

Theme it by setting the `--dk-*` custom properties (see `styles.css`); a deck's
own theme — `dark | light` and one accent — is data on the deck.

## Status

0.1.0, inside `bitbaum/orangecat` (`packages/deckkit`), used by OrangeCat's
investor rooms. It moves to its own repository and npm once a second app
adopts it (fleet `SHARED.md` rule).
