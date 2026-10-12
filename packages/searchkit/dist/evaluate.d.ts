import { type TypoPolicy } from './typo.ts';
export type TypoKind = 'neighbour' | 'drop' | 'double' | 'swap';
/**
 * The one-slip misspellings of a (folded) word: a neighbouring key instead of
 * a letter, a letter dropped, a letter doubled, two adjacent letters swapped.
 * De-duplicated, and never the word itself.
 */
export declare function typoVariants(word: string, kinds?: readonly TypoKind[]): string[];
/** A query and what it should find. */
export interface EvalCase {
    query: string;
    /** Ids that count as the right answer. */
    expect: readonly string[];
}
export interface EvalReport {
    cases: number;
    /** The right answer was first. */
    successAt1: number;
    /** The right answer was in the top 3. */
    successAt3: number;
    /** Mean reciprocal rank of the first right answer (0 when absent). */
    mrr: number;
    /** Share of queries that returned nothing at all. */
    zeroResults: number;
    /** The cases whose answer was not in the top 3, to read. */
    misses: {
        query: string;
        expect: readonly string[];
        got: readonly string[];
    }[];
}
/** Run every case through `search` (ids, best first) and score it. */
export declare function evaluate(cases: readonly EvalCase[], search: (query: string) => readonly string[] | Promise<readonly string[]>): Promise<EvalReport>;
/**
 * Cases from your own names: each name's words, each misspelled once — but
 * only words long enough to be allowed a typo (`typo.ts`), since a 3-letter
 * word with a wrong letter is a different word.
 */
export declare function typoCases(names: readonly {
    id: string;
    name: string;
}[], options?: {
    policy?: TypoPolicy;
    perWord?: number;
    fold?: (s: string) => string[];
}): EvalCase[];
