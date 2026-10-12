import { type TypoPolicy } from './typo.ts';
import { type Vocabulary } from './vocabulary.ts';
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
export interface Searcher<T> {
    search(query: string, options?: SearchOptions): Hit<T>[];
    /** The words of the list, for `didYouMean` and for expanding a query sent elsewhere. */
    readonly vocabulary: Vocabulary;
}
/**
 * Index `items` once; search them as often as you like. Rebuild when the list
 * changes — indexing is linear and cheap next to a network round trip.
 */
export declare function createSearch<T>(items: readonly T[], spec: SearchSpec<T>): Searcher<T>;
/** Sort order for hits: the tie-break values, compared left to right. */
export declare function compareHits<T>(a: Hit<T>, b: Hit<T>): number;
/** Search a list once, without keeping an index. */
export declare function search<T>(items: readonly T[], spec: SearchSpec<T>, query: string, options?: SearchOptions): Hit<T>[];
/**
 * Rank rows another engine already found — a database, an API — by what was
 * typed. Rows the ranker cannot place (they matched on a field you did not
 * pass, or through stemming) keep their original order after the ranked
 * ones: still results, just later ones.
 */
export declare function rerank<T>(rows: readonly T[], spec: SearchSpec<T>, query: string): Array<{
    item: T;
    hit: Hit<T> | null;
}>;
