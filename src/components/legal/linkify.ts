/**
 * Splits a legal paragraph into text and links, so an email address or a web
 * address written in src/config/legal-content.ts is something a reader can
 * tap, not copy by hand. Content stays plain strings; the page decides links.
 */
export type LinkifiedPart =
  { kind: 'text'; text: string } | { kind: 'link'; text: string; href: string };

const PATTERN = /(https?:\/\/[^\s)]+[^\s).,;:]|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function linkify(text: string): LinkifiedPart[] {
  const parts: LinkifiedPart[] = [];
  let last = 0;
  for (const match of text.matchAll(PATTERN)) {
    const value = match[0];
    const start = match.index ?? 0;
    if (start > last) {
      parts.push({ kind: 'text', text: text.slice(last, start) });
    }
    const href = value.startsWith('http') ? value : `mailto:${value}`;
    parts.push({ kind: 'link', text: value, href });
    last = start + value.length;
  }
  if (last < text.length) {
    parts.push({ kind: 'text', text: text.slice(last) });
  }
  return parts;
}
