/**
 * Search a list: find what was meant, and put it first.
 *
 * Matching is per typed word. Each word may match a word of the record
 * exactly, as its start (the reader is still typing), within the typo budget
 * (`typo.ts`), or through a second spelling indexed with the record (German
 * without umlauts, two words written as one). Every typed word must match;
 * a word that matches nothing anywhere is set aside, and when no record has
 * all the rest, the last words are dropped one at a time — so a query with a
 * word too many, or one too mangled to correct, still lands somewhere.
 *
 * Ranking is a tie-break, not a weighted sum. Sums need tuning and drift:
 * a long description outscores a short exact title. Each rule below only
 * decides between records the rules above it called equal:
 *
 *   1. typos      — fewer typos; a wrong FIRST letter counts double here
 *                   (it still matches — Meilisearch refuses it outright, which
 *                   loses every name whose first letter was mistyped)
 *   2. words      — more of the typed words matched (differs only once the
 *                   query has been relaxed)
 *   3. attribute  — matched in a more important field (the order you list them)
 *   4. exact      — the whole field typed exactly; then the whole field
 *                   matched (typos and prefixes allowed: "lki" is all of
 *                   "Loki"); then whole words over prefixes
 *   5. proximity  — the matched words sit closer together, in order
 *   6. position   — the match is nearer the start of the field
 *   7. custom     — your own `rank` (popularity, recency), higher first
 *   8. length     — the shorter field, which is the more specific match
 *
 * It is Algolia's published default order, adjusted for short titles and
 * names, which is what people search a site for.
 */
import { joinedPairs, tokenize, umlautSpelling, writtenLengths, type Token } from './normalize.ts';
import { DEFAULT_TYPO_POLICY, type TypoPolicy } from './typo.ts';
import { candidates, createVocabulary, type Vocabulary } from './vocabulary.ts';

export interface SearchField<T> {
  /** For your own debugging and for `Hit.matches`. */
  name: string;
  get: (item: T) => string | readonly string[] | null | undefined;
}

export interface SearchSpec<T> {
  /** Most important first: a title before a description. */
  fields: readonly SearchField<T>[];
  /** The last tie-break, higher first: popularity, recency. */
  rank?: (item: T) => number;
  typos?: TypoPolicy;
  /**
   * Let typed words match the start of longer words. "all" (default): every
   * word, so "bit pay" finds "Bitcoin payments". "last": only the word being
   * typed. "none": whole words only.
   */
  prefix?: 'all' | 'last' | 'none';
  /**
   * A site's own spelling rule, applied to every word on both sides after
   * the standard folding: Swiss German written as people type it ("ie" and
   * "i", doubled letters), a product's abbreviations. Keep it to how a word
   * is SPELT; meaning belongs elsewhere.
   */
  normalize?: (word: string) => string;
}

/** Where a typed word landed in one field, as offsets into the original text. */
export interface Range {
  start: number;
  end: number;
}

export interface Hit<T> {
  item: T;
  /** Index of the item in the list it was searched from. */
  index: number;
  /** The tie-break values, in rule order. Lower sorts first. */
  score: readonly number[];
  /** How many typed words matched. */
  words: number;
  typos: number;
  /** Matched ranges per field name, for highlighting. */
  matches: Record<string, Range[]>;
}

export interface SearchOptions {
  limit?: number;
  /**
   * When no record has every typed word, drop the last words until some do.
   * Default true.
   */
  relax?: boolean;
}

interface Posting {
  doc: number;
  field: number;
  /** Word position in the field; a joined pair sits at its first word. */
  position: number;
  /** Original-text range to mark. */
  start: number;
  end: number;
  /** A second spelling, not the word as written. */
  alternate: boolean;
  /** The field is exactly this one word (or this joined pair). */
  whole: boolean;
  /**
   * Two words the text wrote apart, indexed together ("cat to" as "catto").
   * Found, but ranked as one typo: it must not beat a real word one slip
   * away ("catto" → Cato). A camelCase or handle pair ("OrangeCat") is the
   * word as written, and is not this.
   */
  bridged?: boolean;
}

interface Indexed {
  vocab: Vocabulary;
  postings: Map<string, Posting[]>;
  /** Words per field per doc, for "the whole field was typed". */
  fieldTerms: string[][][];
}

function fieldTexts<T>(field: SearchField<T>, item: T): string[] {
  const v = field.get(item);
  if (v === null || v === undefined) {
    return [];
  }
  return (typeof v === 'string' ? [v] : [...v]).filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );
}

function buildIndex<T>(items: readonly T[], spec: SearchSpec<T>): Indexed {
  const n = spec.normalize ?? ((w: string) => w);
  const postings = new Map<string, Posting[]>();
  const words: string[] = [];
  const fieldTerms: string[][][] = [];
  const post = (term: string, p: Posting) => {
    const list = postings.get(term);
    if (list) {
      list.push(p);
    } else {
      postings.set(term, [p]);
    }
    words.push(term);
  };

  items.forEach((item, doc) => {
    const perField: string[][] = [];
    spec.fields.forEach((field, f) => {
      const terms: string[] = [];
      // Several values of one field (tags, aliases) are separate texts; a
      // gap of 1000 positions keeps proximity from bridging them.
      fieldTexts(field, item).forEach((text, part) => {
        const tokens: Token[] = tokenize(text);
        const base = part * 1000;
        const whole = tokens.length === 1;
        for (const t of tokens) {
          const term = n(t.term);
          post(term, {
            doc,
            field: f,
            position: base + t.index,
            start: t.start,
            end: t.end,
            alternate: false,
            whole,
          });
          terms.push(term);
          const spelt = umlautSpelling(text.slice(t.start, t.end));
          const other = spelt ? n(spelt) : null;
          if (other && other !== term) {
            post(other, {
              doc,
              field: f,
              position: base + t.index,
              start: t.start,
              end: t.end,
              alternate: true,
              whole,
            });
          }
        }
        joinedPairs(tokens.map(t => n(t.term))).forEach((term, i) => {
          const a = tokens[i]!;
          const b = tokens[i + 1]!;
          post(term, {
            doc,
            field: f,
            position: base + a.index,
            start: a.start,
            end: b.end,
            alternate: true,
            whole: tokens.length === 2,
            bridged: a.end < b.start,
          });
        });
      });
      perField.push(terms);
    });
    fieldTerms.push(perField);
  });

  return { vocab: createVocabulary(words), postings, fieldTerms };
}

/** One typed word's best landing in one document. */
interface Landing {
  typos: number;
  /** Typos for ranking: a wrong first letter counts twice. */
  rankTypos: number;
  field: number;
  position: number;
  prefix: boolean;
  start: number;
  end: number;
  /** Characters of the original word the typed word covered (prefix marks). */
  markEnd: number;
}

const better = (a: Landing, b: Landing) =>
  a.rankTypos - b.rankTypos ||
  a.field - b.field ||
  Number(a.prefix) - Number(b.prefix) ||
  a.position - b.position;

export interface Searcher<T> {
  search(query: string, options?: SearchOptions): Hit<T>[];
  /** The words of the list, for `didYouMean` and for expanding a query sent elsewhere. */
  readonly vocabulary: Vocabulary;
}

/**
 * Index `items` once; search them as often as you like. Rebuild when the list
 * changes — indexing is linear and cheap next to a network round trip.
 */
export function createSearch<T>(items: readonly T[], spec: SearchSpec<T>): Searcher<T> {
  const index = buildIndex(items, spec);
  const policy = spec.typos ?? DEFAULT_TYPO_POLICY;
  const prefixMode = spec.prefix ?? 'all';

  // Letters each typed word had before `normalize`, for the typo budget; set
  // per search (searching is synchronous).
  let written = new Map<string, number>();

  function landingsFor(typed: string, allowPrefix: boolean): Map<number, Landing> {
    const best = new Map<number, Landing>();
    const options = { prefix: allowPrefix, policy, limit: 200, writtenLength: written.get(typed) };
    for (const c of candidates(index.vocab, typed, options)) {
      for (const p of index.postings.get(c.term) ?? []) {
        const typedLength = Array.from(typed).length;
        const firstSlip = c.typos > 0 && Array.from(c.term)[0] !== Array.from(typed)[0];
        const landing: Landing = {
          typos: c.typos,
          rankTypos: c.typos + (firstSlip ? 1 : 0) + (p.bridged ? 1 : 0),
          field: p.field,
          position: p.position,
          prefix: c.prefix,
          start: p.start,
          end: p.end,
          markEnd: c.prefix && !p.alternate ? Math.min(p.end, p.start + typedLength) : p.end,
        };
        const seen = best.get(p.doc);
        if (!seen || better(landing, seen) < 0) {
          best.set(p.doc, landing);
        }
      }
    }
    return best;
  }

  function run(allTerms: string[], typingLast: boolean, relax: boolean): Hit<T>[] {
    const allLandings = allTerms.map((term, i) =>
      landingsFor(
        term,
        prefixMode === 'all' || (prefixMode === 'last' && typingLast && i === allTerms.length - 1)
      )
    );
    // A word that matches nothing anywhere ("pen" for "open", too short for a
    // typo) cannot help, so with `relax` it stops being required rather than
    // emptying the whole result.
    const keep = allTerms.map((_, i) => !relax || allLandings[i]!.size > 0);
    const terms = allTerms.filter((_, i) => keep[i]);
    const perTerm = allLandings.filter((_, i) => keep[i]);
    const hits: Hit<T>[] = [];
    const first = perTerm[0];
    if (!first) {
      return hits;
    }
    for (const doc of first.keys()) {
      const landings = perTerm.map(m => m.get(doc));
      if (landings.some(l => !l)) {
        continue;
      }
      const ls = landings as Landing[];
      const typos = ls.reduce((s, l) => s + l.typos, 0);
      const rankTypos = ls.reduce((s, l) => s + l.rankTypos, 0);
      const field = Math.min(...ls.map(l => l.field));
      const typedWhole = index.fieldTerms[doc]!.some(
        fieldWords =>
          fieldWords.length === terms.length && fieldWords.every((w, i) => w === terms[i])
      );
      const exactWords = ls.filter(l => !l.prefix && l.typos === 0).length;
      // Every word of the matched field was matched: "lki" is the WHOLE of
      // "Loki", but only the first word of "Loki — Capability Layer". And
      // every typed word landed there: for "gallium ch", "ch" alone covering
      // a title "Chalco" (gallium only in its description) is not the name.
      const fieldLength = index.fieldTerms[doc]![field]!.length;
      const coversField =
        ls.every(l => l.field === field) && new Set(ls.map(l => l.position)).size >= fieldLength;
      let proximity = 0;
      for (let i = 1; i < ls.length; i++) {
        const a = ls[i - 1]!;
        const b = ls[i]!;
        const gap = a.field === b.field ? b.position - a.position : 8;
        // In order and adjacent costs 0; out of order or apart costs more, capped.
        proximity += gap === 1 ? 0 : Math.min(gap > 0 ? gap : Math.abs(gap) + 1, 8);
      }
      const position = Math.min(...ls.filter(l => l.field === field).map(l => l.position % 1000));
      const item = items[doc]!;
      const matches: Record<string, Range[]> = {};
      for (const l of ls) {
        const name = spec.fields[l.field]!.name;
        (matches[name] ??= []).push({ start: l.start, end: l.markEnd });
      }
      hits.push({
        item,
        index: doc,
        words: terms.length,
        typos,
        matches,
        score: [
          rankTypos,
          -terms.length,
          field,
          typedWhole ? -1000 : coversField ? -500 - exactWords : -exactWords,
          proximity,
          position,
          -(spec.rank?.(item) ?? 0),
          fieldLength,
          doc,
        ],
      });
    }
    return hits;
  }

  return {
    vocabulary: index.vocab,
    search(query, options = {}) {
      const { limit = Infinity, relax = true } = options;
      written = writtenLengths(query, spec.normalize);
      const terms = [...written.keys()];
      if (terms.length === 0) {
        return [];
      }
      const typingLast = !/\s$/.test(query);
      let hits = run(terms, typingLast, relax);
      // Written apart, meant together ("orange cat" for "Orangecat"), or the
      // other way round ("orangecat" for "Orange Cat" is indexed as a joined
      // pair already; a joined word the index has never seen is split where
      // both halves are words it has).
      if (hits.length === 0 && terms.length > 1) {
        hits = run(joinAdjacent(terms, index.vocab), typingLast, relax);
      }
      if (hits.length === 0) {
        const split = splitUnknown(terms, index.vocab);
        if (split) {
          hits = run(split, typingLast, relax);
        }
      }
      // No item has every word: keep as many as some item has, whichever
      // they are. "jon smith" finds both Jon Snow and John Smith; dropping
      // only the LAST word would lose John Smith.
      if (relax) {
        for (let keep = terms.length - 1; hits.length === 0 && keep >= 1; keep--) {
          const best = new Map<number, Hit<T>>();
          for (const subset of combinations(terms.length, keep)) {
            const typing = typingLast && subset[subset.length - 1] === terms.length - 1;
            for (const hit of run(
              subset.map(i => terms[i]!),
              typing,
              relax
            )) {
              const seen = best.get(hit.index);
              if (!seen || compareHits(hit, seen) < 0) {
                best.set(hit.index, hit);
              }
            }
          }
          hits = [...best.values()];
        }
      }
      return hits.sort(compareHits).slice(0, limit);
    },
  };
}

/**
 * Index sets of size k from 0..n-1, in order; past 8 words only the leading
 * ones (a pasted sentence is not worth 2^n searches).
 */
function combinations(n: number, k: number): number[][] {
  if (n > 8) {
    return [Array.from({ length: k }, (_, i) => i)];
  }
  const out: number[][] = [];
  const pick = (start: number, chosen: number[]) => {
    if (chosen.length === k) {
      out.push(chosen);
      return;
    }
    for (let i = start; i <= n - (k - chosen.length); i++) {
      pick(i + 1, [...chosen, i]);
    }
  };
  pick(0, []);
  return out;
}

/** Join each adjacent pair the vocabulary knows as one word. */
function joinAdjacent(terms: string[], vocab: Vocabulary): string[] {
  const out: string[] = [];
  for (let i = 0; i < terms.length; i++) {
    const joined = i + 1 < terms.length ? terms[i]! + terms[i + 1]! : null;
    if (joined && vocab.counts.has(joined)) {
      out.push(joined);
      i++;
    } else {
      out.push(terms[i]!);
    }
  }
  return out;
}

/** Split each unknown word at the first point where both halves are known words. */
function splitUnknown(terms: string[], vocab: Vocabulary): string[] | null {
  let changed = false;
  const out = terms.flatMap(term => {
    if (vocab.counts.has(term)) {
      return [term];
    }
    const letters = Array.from(term);
    for (let i = 2; i <= letters.length - 2; i++) {
      const a = letters.slice(0, i).join('');
      const b = letters.slice(i).join('');
      if (vocab.counts.has(a) && vocab.counts.has(b)) {
        changed = true;
        return [a, b];
      }
    }
    return [term];
  });
  return changed ? out : null;
}

/** Sort order for hits: the tie-break values, compared left to right. */
export function compareHits<T>(a: Hit<T>, b: Hit<T>): number {
  for (let i = 0; i < a.score.length; i++) {
    const d = (a.score[i] ?? 0) - (b.score[i] ?? 0);
    if (d !== 0) {
      return d;
    }
  }
  return 0;
}

/** Search a list once, without keeping an index. */
export function search<T>(
  items: readonly T[],
  spec: SearchSpec<T>,
  query: string,
  options?: SearchOptions
): Hit<T>[] {
  return createSearch(items, spec).search(query, options);
}

/**
 * Rank rows another engine already found — a database, an API — by what was
 * typed. Rows the ranker cannot place (they matched on a field you did not
 * pass, or through stemming) keep their original order after the ranked
 * ones: still results, just later ones.
 */
export function rerank<T>(
  rows: readonly T[],
  spec: SearchSpec<T>,
  query: string
): Array<{ item: T; hit: Hit<T> | null }> {
  const hits = createSearch(rows, spec).search(query);
  const placed = new Set(hits.map(h => h.index));
  return [
    ...hits.map(hit => ({ item: hit.item, hit })),
    ...rows.filter((_, i) => !placed.has(i)).map(item => ({ item, hit: null })),
  ];
}
