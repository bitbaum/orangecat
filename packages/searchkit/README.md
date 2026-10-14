# searchkit

Search that finds what was meant.

You start typing and you get where you need to go. One wrong letter in a
name — the SoundCloud failure, where an artist is unfindable because you typed
`kayne` — still finds it. Zero dependencies; React optional.

A survey of the fleet on 2026-10-12 found about 25 search boxes, and one with
any typo tolerance (substrata's own engine). The rest were
`text.toLowerCase().includes(q)` or an SQL `ILIKE '%q%'`: no typos, no
ranking, a few without escaping `%`. Every new site would have written a 26th.

## Where it lives, and how a site adopts it

Its home is `bitbaum/searchkit`, created from this folder by bitbaum/fleet's
`package-repos` workflow (declared in `registers/package-repos.json`). Until
that repository exists the source is `bitbaum/orangecat` `packages/searchkit`.
A site installs a release tag, which Dependabot moves forward on its own:

```jsonc
// package.json
"@bitbaum/searchkit": "github:bitbaum/searchkit#v0.2.2"
```

It ships compiled JavaScript in `dist/`, committed beside the source the way
`@bitbaum/whenkit` does, so nothing has to transpile it: Next.js, Vitest, and
Node's own test runner (which refuses TypeScript inside `node_modules`) all
load it as is. Its tests are in `test/` and run with plain Node (`npm test`);
one of them fails while `dist/` is not the build of `src/` (`npm run build`).

**Every search box in the fleet should go through it.** The first adopter,
OrangeCat, runs it in three places: the ⌘K palette's own lists (pages, your
things), `/api/search` (vocabulary corrections handed to Postgres, then
ranking), and `/discover`.

## What it ships

```ts
import { createSearch } from '@bitbaum/searchkit';

const people = createSearch(rows, {
  fields: [
    { name: 'name', get: p => p.name }, // most important first
    { name: 'handle', get: p => p.username },
    { name: 'bio', get: p => p.bio },
  ],
  rank: p => Math.log1p(p.followers), // last tie-break only
});

people.search('kayne wset'); // → Kanye West, with ranges to mark
```

### Matching — what counts as the same word

| typed                     | finds                 | how                                                                                                                                                     |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cqto`                    | Cato                  | one wrong letter (budget: 0 typos under 4 letters, 1 from 4, 2 from 8)                                                                                  |
| `kayne`                   | Kanye                 | a swap is ONE typo (optimal string alignment)                                                                                                           |
| `koki`                    | Loki                  | a wrong first letter still matches — ranked as two typos                                                                                                |
| `lo`                      | Loki                  | the start of a word, while typing                                                                                                                       |
| `bitcon`                  | Bitcoin               | a typo in the start of a word                                                                                                                           |
| `zurich`, `mueller`       | Zürich, Müller        | accents folded; umlauts also indexed spelled out                                                                                                        |
| `orangecat`, `orange cat` | OrangeCat, Orange Cat | camelCase and separators split; adjacent words also indexed joined (ranked as a typo when the text wrote them apart, so `catto` still finds Cato first) |
| `cato xylophone`          | Cato                  | a word that matches nothing is set aside, not fatal                                                                                                     |
| `jon smith`               | Jon Snow, John Smith  | when no item has every word, the most words any item has are kept — whichever words they are                                                            |

The budget is the one Algolia and Typesense use. Meilisearch's (one typo from
5 letters, a first-letter typo costs two) cannot find a mistyped 4-letter name
at all, and a 5–8-letter one whose first letter slipped.

### Ranking — a tie-break, not a weighted sum

Each rule only decides between results the rules above it called equal:
typos → words matched → field → exactness (the whole field typed, then whole
words, then prefixes) → proximity → position in the field → your `rank` →
shorter field. Sums need tuning and drift; a long description outscores a
short exact title. This is Algolia's published order, adjusted for names.

### For a search that runs in a database

The forgiving part does not need to live in the database. Keep the
collection's words (`createVocabulary`), expand what was typed into the words
it could mean, and send those along:

```ts
import { corrections, createVocabulary, didYouMean } from '@bitbaum/searchkit';

const vocab = createVocabulary(wordsWithCounts); // e.g. from a cached SQL view
corrections('cqto', vocab); // → ["cato"]: OR these into your tsquery / ILIKE
didYouMean('cqto', vocab); // → "cato", for the zero-result screen
```

Then rerank the rows the database returned with `createSearch` — one ranking
for in-memory lists and database results alike.

Why not do it in Postgres: `pg_trgm` scores `kanye`/`kayne` at 0.2 and
`cqto`/`cato` at 0.4, under any useful threshold, and `fuzzystrmatch`'s
`levenshtein` counts a swap as two edits. Use trigrams for recall at a low
threshold if you like; decide typos here.

### Your own spelling rule — `normalize`

`SearchSpec.normalize(word)` runs on every word, both sides, after the
standard folding. Heidi reads Swiss German as people type it: "ie" as "i",
doubled letters as one, so `gruzi mittenand` finds "Grüezi mitenand". Keep it
to spelling; meaning belongs elsewhere. `expandQuery`/`corrections` take the
same function so a vocabulary agrees with the index. The typo budget stays the
WRITTEN word's: the rule turns "vill" into "vil", and a slip in "vill" is
still forgiven as in any four-letter word.

### Rows a database already found — `rerank`

`rerank(rows, spec, query)` ranks them by what was typed and keeps the rows
it cannot place (matched on a field you did not pass, or by stemming) after
the ranked ones, in their original order. OrangeCat's `/api/search` ranks
Postgres candidates this way.

### Highlighting

`hit.matches[field]` holds ranges into the original text (a typo match marks
the whole word; a prefix only what was typed). `highlightQuery(text, q)` marks
words that start with a typed word, for text that was not searched. Both
return plain parts — never HTML. `snippet(text, ranges, { maxLength })` cuts
a long description to the window around its first match, at word
boundaries, with "…" where it was cut, and re-bases the ranges onto it.

### React (`@bitbaum/searchkit/react`)

- `useSearchAsYouType(text, (q, signal) => fetch(...), { debounceMs: 100 })` —
  each keystroke aborts the request before it; a late answer to an older
  query is dropped.
- `<Highlight text ranges | query markClassName />` — unstyled `<mark>`s.

### Proving it — `typoCases` and `evaluate`

```ts
const cases = typoCases(names); // every one-slip misspelling of every name
const report = await evaluate(cases, q => search(q).map(h => h.id));
// { successAt1, successAt3, mrr, zeroResults, misses }
```

Slips are generated, not imagined: a neighbouring key (QWERTY and QWERTZ), a
dropped letter, a doubled letter, a swapped pair. Put it in CI and "one slip
still finds it" fails the day it stops being true. This package's own suite
runs 571 such cases over eight names at success@1 = 1.

## What it does not do

- **Meaning.** "someone to fix my bike" finding "Velo repair" is embeddings'
  job (descriptive queries, never names — dense retrieval loses to lexical on
  names by tens of points). Fuse such results with Reciprocal Rank Fusion
  (k = 60) if you add them.
- **Security.** Whether a row may be shown is decided before it reaches this
  package. An in-memory matcher has no business behind a visibility gate.
- **Phonetics.** Schmidt/Schmitt, Meier/Mayer. Useful for person names only,
  harmful elsewhere; not yet built.

## Sources

Algolia typo tolerance and ranking criteria; Typesense search parameters;
Meilisearch typo internals; Damerau (1964), Pollock & Zamora (1983) on single
edits; Schulz & Mihov (2002) on Levenshtein automata; SymSpell; Nielsen's
response-time limits; Cormack, Clarke & Büttcher (SIGIR 2009) on RRF;
Sciavolino et al. (EMNLP 2021) on dense retrieval and entity names.
