/**
 * Text to words, the same way on both sides of a search.
 *
 * Everything a person might type differently from how a title is written must
 * be folded here, once, or the matcher has to forgive it later as a "typo" —
 * which spends the typo budget on something that was not a mistake:
 *
 *  - case and accents: "zurich" is "Zürich", "cafe" is "Café";
 *  - letters with no decomposition: ß → ss, æ → ae, ø → o, ł → l;
 *  - German spelled without umlauts: "Mueller" is "Müller" (handled at
 *    indexing: a word with ä/ö/ü is also indexed with ae/oe/ue);
 *  - joined and split words: "OrangeCat", "orange_cat", "orange-cat" and
 *    "orange cat" are one name (camelCase and separators split; adjacent
 *    words are also indexed joined, see `joinedPairs`).
 */
/** Casefold and strip accents. "Straße Zürich" → "strasse zurich". */
export declare function fold(text: string): string;
/** One word of a text, with where it sits in the original string. */
export interface Token {
    /** Folded form, the thing compared. */
    term: string;
    /** Position among the text's words, 0-based. */
    index: number;
    /** Offsets into the ORIGINAL text, for highlighting. */
    start: number;
    end: number;
}
/** The words of a text, folded, with their original offsets. */
export declare function tokenize(text: string): Token[];
/** Just the folded words. */
export declare function words(text: string): string[];
/**
 * The other spelling of a German word written with umlauts: "müller" →
 * "mueller". Returns null when the word has none. Applied to the ORIGINAL
 * word (before folding, which turns ü into u).
 */
export declare function umlautSpelling(original: string): string | null;
/**
 * Adjacent words joined: ["orange", "cat", "shop"] → ["orangecat", "catshop"].
 * Indexed alongside the words so a query typed without the space still finds
 * the name typed with it.
 */
export declare function joinedPairs(terms: string[]): string[];
/** Each typed word after the site's spelling rule, with how long it was as written. */
export declare function writtenLengths(query: string, normalize: ((word: string) => string) | undefined): Map<string, number>;
