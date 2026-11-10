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
