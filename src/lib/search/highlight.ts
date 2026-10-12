/**
 * Which parts of a result match what was typed — so a search result shows WHY
 * it is there. Accent- and case-insensitive like the engine ("zurich" marks
 * "Zürich"), and only at the start of a word, as the engine matches: "lo"
 * marks "Loki" and "local", never the middle of "technological". Returns plain text
 * parts; the caller renders them, so nothing here is ever injected as HTML.
 */

const WORD_CHAR = /[\p{L}\p{N}]/u;

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** One character, folded the way the search engine folds it. */
function fold(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function queryWords(query: string): string[] {
  return Array.from(new Set(fold(query).split(/[^\p{L}\p{N}]+/u))).filter(Boolean);
}

export function highlightParts(text: string, query: string): HighlightPart[] {
  const words = queryWords(query);
  if (!text || words.length === 0) {
    return text ? [{ text, match: false }] : [];
  }

  // Fold char by char, remembering where each folded char came from, so a
  // range found in the folded text maps back onto the original.
  const chars = Array.from(text);
  let folded = '';
  const origin: number[] = [];
  chars.forEach((char, i) => {
    for (const f of fold(char)) {
      folded += f;
      origin.push(i);
    }
  });

  const marked = new Array<boolean>(chars.length).fill(false);
  for (const word of words) {
    let from = folded.indexOf(word);
    while (from !== -1) {
      if (from === 0 || !WORD_CHAR.test(folded[from - 1])) {
        for (let k = from; k < from + word.length; k++) {
          marked[origin[k]] = true;
        }
      }
      from = folded.indexOf(word, from + 1);
    }
  }

  const parts: HighlightPart[] = [];
  chars.forEach((char, i) => {
    const last = parts[parts.length - 1];
    if (last && last.match === marked[i]) {
      last.text += char;
    } else {
      parts.push({ text: char, match: marked[i] });
    }
  });
  return parts;
}
