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
