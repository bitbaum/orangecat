/**
 * The words a collection actually contains, and which of them a typed word
 * could mean.
 *
 * Correcting against the collection's OWN vocabulary is what makes typo
 * tolerance safe: "cqto" is corrected to "cato" because Cato is here, never to
 * a dictionary word nobody listed. It is also what lets a database without
 * typo tolerance have it: expand the typed words into the vocabulary words
 * they could mean (`expandQuery`), and send those.
 */
import { editDistance, prefixDistance } from "./distance.js";
import { DEFAULT_TYPO_POLICY, typoBudget } from "./typo.js";
/** A vocabulary from words (repeats are counted) or from [word, count] pairs. */
export function createVocabulary(entries) {
    const counts = new Map();
    for (const entry of entries) {
        const [term, n] = typeof entry === 'string' ? [entry, 1] : entry;
        if (term) {
            counts.set(term, (counts.get(term) ?? 0) + n);
        }
    }
    return { terms: [...counts.keys()].sort(), counts };
}
/** First index in sorted `terms` not less than `key`. */
function lowerBound(terms, key) {
    let lo = 0;
    let hi = terms.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (terms[mid] < key) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }
    return lo;
}
/**
 * The vocabulary words a typed (folded) word could mean, best first: exact,
 * then exact prefixes, then within the typo budget — fewer typos first, then
 * the more common word.
 */
export function candidates(vocab, typed, options = {}) {
    const { prefix = true, policy = DEFAULT_TYPO_POLICY, limit = 50, writtenLength } = options;
    if (!typed) {
        return [];
    }
    const found = new Map();
    const add = (term, typos, isPrefix) => {
        const seen = found.get(term);
        if (!seen || typos < seen.typos || (typos === seen.typos && seen.prefix && !isPrefix)) {
            found.set(term, { term, typos, prefix: isPrefix, count: vocab.counts.get(term) ?? 0 });
        }
    };
    if (vocab.counts.has(typed)) {
        add(typed, 0, false);
    }
    if (prefix) {
        for (let i = lowerBound(vocab.terms, typed); i < vocab.terms.length; i++) {
            const term = vocab.terms[i];
            if (!term.startsWith(typed)) {
                break;
            }
            if (term !== typed) {
                add(term, 0, true);
            }
        }
    }
    const length = Array.from(typed).length;
    const budgetLength = Math.max(length, writtenLength ?? 0);
    let budget = typoBudget(budgetLength, policy);
    // The budget belongs to the word that was MEANT. Drop a letter from "Loki"
    // and what was typed ("lki") is too short for a typo — so when a short word
    // matches nothing at all, it may still be one slip from a word long enough
    // to be allowed one. Only then: "cat" must stay "cat" when "cat" exists.
    let minTermLength = 0;
    if (budget === 0 && found.size === 0 && budgetLength >= policy.oneTypoFrom - 1) {
        budget = 1;
        minTermLength = policy.oneTypoFrom;
    }
    if (budget > 0) {
        for (const term of vocab.terms) {
            if (found.get(term)?.typos === 0) {
                continue;
            }
            const termLength = term.length;
            if (termLength < minTermLength) {
                continue;
            }
            if (termLength + budget < length) {
                continue;
            }
            if (termLength <= length + budget) {
                const d = editDistance(typed, term, budget);
                if (d <= budget) {
                    add(term, d, false);
                    continue;
                }
            }
            // A slip in a word's START is not forgiven on the fallback: "cqt" would
            // be one edit from the start of every word beginning "ca".
            if (prefix && minTermLength === 0 && termLength > length) {
                const d = prefixDistance(typed, term, budget);
                if (d <= budget) {
                    add(term, d, true);
                }
            }
        }
    }
    return [...found.values()]
        .sort((a, b) => a.typos - b.typos ||
        Number(a.prefix) - Number(b.prefix) ||
        b.count - a.count ||
        a.term.length - b.term.length ||
        (a.term < b.term ? -1 : 1))
        .slice(0, limit);
}
