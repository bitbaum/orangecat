/**
 * Lexical fact matching for Cat memory: does a phrase the user says refer to
 * a stored memory? Pure text — a conservative stemmer, whole-word containment
 * and stem overlap. The forget, suppress and edit paths in memory.ts all
 * decide "same fact" through phrasesOverlap / the same pieces, so they cannot
 * disagree. Moved verbatim from memory.ts.
 */

/**
 * Light suffix-stripping stemmer so inflected forms match: "photography" and
 * "photographer" both stem to "photograph", "ceramics" → "ceramic",
 * "speaking"/"speaks" → "speak", "weekends" → "weekend". Deliberately
 * conservative: strips only while ≥4 chars remain, and stems compare by
 * EQUALITY — never substring — so "constraint" can't collide with
 * "construction".
 */
const STEM_SUFFIXES = ['ing', 'ers', 'ed', 'er', 'es', 's', 'y', 'e'] as const;
function stemWord(word: string): string {
  let s = word;
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of STEM_SUFFIXES) {
      if (s.endsWith(suffix) && s.length - suffix.length >= 4) {
        s = s.slice(0, -suffix.length);
        changed = true;
        break;
      }
    }
  }
  return s;
}

/**
 * Does `haystack` contain `needle` as WHOLE WORDS?
 *
 * The containment branch used raw `String.includes` in both directions, and
 * MIN_FORGET_FRAGMENT_CHARS lets a four-character fact through. So "work" was
 * contained in "network", "framework", "coworking" and "homework": asking Cat
 * to forget "work" deleted every one of those memories, and Cat then reported
 * them as removed — accurately, which is exactly what made it hard to notice.
 *
 * Boundaries are checked by CHARACTER CLASS rather than a `\b` regex, because
 * `\b` is ASCII-only in JavaScript: it treats "café" as ending after "caf",
 * so "café" would match inside "cafés" while plain words behaved correctly.
 * `\p{L}` and `\p{N}` cover the accented alphabet the tokenizer above already
 * speaks. bitbaum/orangecat#563 finding 9.
 */
const WORD_CHAR = /[\p{L}\p{N}]/u;
export function containsWholeWords(haystack: string, needle: string): boolean {
  if (!needle || !haystack) {
    return false;
  }
  for (let from = 0; from <= haystack.length - needle.length;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) {
      return false;
    }
    const before = at === 0 ? '' : haystack[at - 1]!;
    const after = haystack[at + needle.length] ?? '';
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) {
      return true;
    }
    from = at + 1;
  }
  return false;
}

/** Significant stemmed words of a phrase (short glue words dropped). */
export function significantStems(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9äöüéèàç]+/)
      .filter(t => t.length >= 4)
      .map(stemWord)
  );
}

/**
 * How many of a fact's significant stems must appear in a memory for the
 * LEXICAL layer to call it a match.
 *
 * A majority rule (ceil(n/2)) is WRONG for two-word facts: it needs only one
 * hit, so "photography skills" matches "Has strong cooking skills" on the
 * shared stem "skill" and silently deletes an unrelated memory. Deleting the
 * wrong memory is the worst failure this code has, so multi-word facts require
 * TWO stem hits; looser paraphrases ("speaking French" → "Knows French", one
 * shared stem) are caught by the semantic layer instead, which scores them
 * 0.45+ while unrelated pairs stay ≤0.29.
 */
function requiredStemHits(factStemCount: number): number {
  return factStemCount <= 1 ? 1 : 2;
}

/** Do `a`'s significant stems appear in `b` often enough to be the same fact? */
export function stemOverlapMatches(aStems: Set<string>, bStems: Set<string>): boolean {
  if (aStems.size === 0) {
    return false;
  }
  let hits = 0;
  for (const s of aStems) {
    if (bStems.has(s)) {
      hits++;
    }
  }
  return hits >= requiredStemHits(aStems.size);
}

/**
 * Shared lexical predicate: does phrase `a` refer to (roughly) the same fact
 * as phrase `b`? Containment in either direction, or enough shared stems —
 * the SAME rule the forget matcher uses, so "what gets forgotten", "what stays
 * suppressed", and "which memory gets edited" can never disagree.
 */
export function phrasesOverlap(a: string, b: string): boolean {
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  if (nb.includes(na) || na.includes(nb)) {
    return true;
  }
  return stemOverlapMatches(significantStems(na), significantStems(nb));
}
