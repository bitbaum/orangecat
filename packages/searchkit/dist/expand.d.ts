import { type TypoPolicy } from './typo.ts';
import { type Candidate, type Vocabulary } from './vocabulary.ts';
export interface ExpandedWord {
    /** The word as typed, folded. */
    typed: string;
    /** The collection's words it could mean, best first (exact and prefixes included). */
    candidates: Candidate[];
}
export interface ExpandOptions {
    policy?: TypoPolicy;
    /** Per typed word, at most this many corrected spellings. Default 5. */
    perWord?: number;
    /** The same site spelling rule the vocabulary was built with (`SearchSpec.normalize`). */
    normalize?: (word: string) => string;
}
/** Every typed word with the collection's words it could mean. */
export declare function expandQuery(query: string, vocab: Vocabulary, options?: ExpandOptions): ExpandedWord[];
/**
 * The words to send to an exact/prefix backend so it forgives typos: each
 * correction that is not simply what was typed. "cqto pots" → ["cato", "post"].
 */
export declare function corrections(query: string, vocab: Vocabulary, options?: ExpandOptions): string[];
/**
 * The closest query whose words all exist, or null when every word already
 * does (or none can be corrected). Prefers fewer typos, then the commoner word.
 */
export declare function didYouMean(query: string, vocab: Vocabulary, policy?: TypoPolicy): string | null;
