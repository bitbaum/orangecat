/**
 * The one line a share card says about something: its first sentence when
 * that sentence is a reasonable length, else the first ~140 characters cut
 * on a word boundary. Whitespace is collapsed — descriptions arrive with the
 * line breaks people typed.
 */
export function shareLine(description: string | null): string {
  const text = (description ?? '').replace(/\s+/g, ' ').trim();
  if (!text) {
    return '';
  }
  const sentence = text.match(/^.{20,160}?[.!?](\s|$)/)?.[0]?.trim();
  if (sentence) {
    return sentence;
  }
  if (text.length <= 140) {
    return text;
  }
  return `${text.slice(0, 140).replace(/\s+\S*$/, '')}…`;
}

/** X counts every link as 23 characters (t.co), and puts it after the text with a space. */
const X_LIMIT = 280;
const X_LINK = 23;
const X_TEXT_BUDGET = X_LIMIT - X_LINK - 1;

/**
 * Length the way X counts it: Latin, most scripts up to U+10FF and common
 * punctuation weigh 1, everything else (CJK, emoji, "…") weighs 2. Counting
 * each code point of an emoji sequence over-counts, which only errs short.
 */
export function xWeightedLength(text: string): number {
  let length = 0;
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const light =
      cp <= 0x10ff ||
      (cp >= 0x2000 && cp <= 0x200d) ||
      (cp >= 0x2010 && cp <= 0x201f) ||
      (cp >= 0x2032 && cp <= 0x2037);
    length += light ? 1 : 2;
  }
  return length;
}

/**
 * The text "Share on X" prefills: the title, the share line and the tags,
 * dropping the tags and then the line until it fits one post beside the link.
 * The whole description used to go in (QA 2026-11-12: 434-983 characters),
 * so X opened over its limit with Post disabled.
 */
export function xPostText(title: string, description: string | null, hashtags = ''): string {
  const line = shareLine(description);
  const drafts = [[title, line, hashtags], [title, line], [title, hashtags], [title]];
  for (const parts of drafts) {
    const text = parts.filter(Boolean).join('\n\n');
    if (xWeightedLength(text) <= X_TEXT_BUDGET) {
      return text;
    }
  }
  // A title longer than a post on its own: cut on a word boundary.
  let cut = '';
  for (const char of title) {
    if (xWeightedLength(cut + char) > X_TEXT_BUDGET - 2) {
      break;
    }
    cut += char;
  }
  return `${cut.replace(/\s+\S*$/, '')}…`;
}

/**
 * A page's meta / og:description: the whole text when it fits, else cut on a
 * word boundary with an ellipsis. Search engines and chat apps truncate long
 * descriptions themselves, mid-word (QA 2026-11-10: Loki's 700-character
 * description), so the page says where it ends instead.
 */
export function metaDescription(description: string | null, max = 160): string {
  const text = (description ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) {
    return text;
  }
  const cut = text
    .slice(0, max - 1)
    .replace(/\s+\S*$/, '')
    .replace(/[\s,;:—–-]+$/, '');
  return `${cut}…`;
}
