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
/** Letters that NFKD does not decompose, mapped the way their languages spell them in ASCII. */
const LETTERS = {
    ß: 'ss',
    ẞ: 'ss',
    æ: 'ae',
    Æ: 'ae',
    œ: 'oe',
    Œ: 'oe',
    ø: 'o',
    Ø: 'o',
    ł: 'l',
    Ł: 'l',
    đ: 'd',
    Đ: 'd',
    ð: 'd',
    þ: 'th',
    ı: 'i',
};
const SPECIAL = new RegExp(`[${Object.keys(LETTERS).join('')}]`, 'g');
/** Casefold and strip accents. "Straße Zürich" → "strasse zurich". */
export function fold(text) {
    return text
        .replace(SPECIAL, c => LETTERS[c] ?? c)
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .toLowerCase();
}
// A word is a run of letters and digits. camelCase boundaries ("OrangeCat",
// "myHTMLParser" → my HTML Parser) also split, before case is folded away.
const WORD = /[\p{L}\p{N}]+/gu;
const CAMEL = /(?<=\p{Ll})(?=\p{Lu})|(?<=\p{Lu})(?=\p{Lu}\p{Ll})|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u;
/** The words of a text, folded, with their original offsets. */
export function tokenize(text) {
    const tokens = [];
    for (const match of text.matchAll(WORD)) {
        let offset = match.index ?? 0;
        for (const part of match[0].split(CAMEL)) {
            if (part) {
                tokens.push({
                    term: fold(part),
                    index: tokens.length,
                    start: offset,
                    end: offset + part.length,
                });
            }
            offset += part.length;
        }
    }
    return tokens;
}
/** Just the folded words. */
export function words(text) {
    return tokenize(text).map(t => t.term);
}
/**
 * The other spelling of a German word written with umlauts: "müller" →
 * "mueller". Returns null when the word has none. Applied to the ORIGINAL
 * word (before folding, which turns ü into u).
 */
export function umlautSpelling(original) {
    if (!/[äöüÄÖÜ]/.test(original)) {
        return null;
    }
    return fold(original.replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue'));
}
/**
 * Adjacent words joined: ["orange", "cat", "shop"] → ["orangecat", "catshop"].
 * Indexed alongside the words so a query typed without the space still finds
 * the name typed with it.
 */
export function joinedPairs(terms) {
    const out = [];
    for (let i = 0; i + 1 < terms.length; i++) {
        out.push(terms[i] + terms[i + 1]);
    }
    return out;
}
/** Each typed word after the site's spelling rule, with how long it was as written. */
export function writtenLengths(query, normalize) {
    const out = new Map();
    for (const t of tokenize(query)) {
        const term = normalize ? normalize(t.term) : t.term;
        if (term) {
            out.set(term, Math.max(out.get(term) ?? 0, Array.from(t.term).length));
        }
    }
    return out;
}
