import { type TypoPolicy } from './typo.ts';
/** How a vocabulary word answers a typed word. */
export interface Candidate {
    term: string;
    /** Edits between what was typed and the word (or its start, for a prefix). */
    typos: number;
    /** The typed word matched only the start of this word. */
    prefix: boolean;
    /** How often the word occurs in the collection. */
    count: number;
}
export interface Vocabulary {
    /** Every distinct word, sorted, for prefix ranges. */
    readonly terms: readonly string[];
    readonly counts: ReadonlyMap<string, number>;
}
/** A vocabulary from words (repeats are counted) or from [word, count] pairs. */
export declare function createVocabulary(entries: Iterable<string | readonly [string, number]>): Vocabulary;
export interface CandidateOptions {
    /** Let the typed word match the start of a longer word. Default true. */
    prefix?: boolean;
    policy?: TypoPolicy;
    /** At most this many, best first. Default 50. */
    limit?: number;
    /**
     * How many letters the word had as written, when a site spelling rule
     * (`SearchSpec.normalize`) shortened it: the typo budget is the written
     * word's. Heidi reads doubled letters as one, so "vill" arrives as "vil" —
     * and a three-letter word would get no typo at all.
     */
    writtenLength?: number;
}
/**
 * The vocabulary words a typed (folded) word could mean, best first: exact,
 * then exact prefixes, then within the typo budget — fewer typos first, then
 * the more common word.
 */
export declare function candidates(vocab: Vocabulary, typed: string, options?: CandidateOptions): Candidate[];
