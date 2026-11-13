/**
 * A bot's library: the photos, files and links that passed through its chats
 * with one person, newest first.
 *
 * Grok Bot keeps a "Library" per chat. Nothing new is stored for this one:
 * a stored message already says what went with it (the attachment tags the
 * thread draws its chips from, lib/chat/attachment-tags) and a link is in
 * the words. The library is those lines read again, so it can never show a
 * thing the chat did not carry, and forgetting a conversation empties it.
 */
import { parseUserMessage } from '@/lib/chat/attachment-tags';

export type LibraryKind = 'photo' | 'file' | 'link' | 'picture';

export interface LibraryItem {
  kind: LibraryKind;
  /** A file's or photo's name; a link's address without its scheme. */
  name: string;
  /** Where a link or a bot's picture opens. */
  url?: string;
  /** A stored photo's private path: the route turns it into a short-lived link. */
  ref?: string;
  /** Who brought it into the chat. */
  from: 'you' | 'bot';
  at: string;
}

export interface LibraryRow {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/** A hundred of each is a library; more is a log. */
export const LIBRARY_MAX_ITEMS = 300;

const LINK = /https?:\/\/[^\s<>"')\]]+/g;
/** A picture a bot's browser took (Loki's shot door): shown as a picture, not a link. */
const SHOT = /\/api\/orangecat\/shot\/[0-9a-f]{32}$/;

function linksIn(text: string): string[] {
  return [...new Set((text.match(LINK) ?? []).map(u => u.replace(/[.,;:!?]+$/, '')))];
}

/** Everything the rows carried, newest first, each link once (its latest). Pure. */
export function libraryFrom(rows: readonly LibraryRow[]): LibraryItem[] {
  const items: LibraryItem[] = [];
  const seenLinks = new Set<string>();
  const newestFirst = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  for (const row of newestFirst) {
    const from = row.role === 'user' ? 'you' : 'bot';
    let text = row.content;
    if (row.role === 'user') {
      const parsed = parseUserMessage(row.content);
      text = parsed.text;
      for (const image of parsed.images) {
        items.push({
          kind: 'photo',
          name: image.name,
          ...(image.ref ? { ref: image.ref } : {}),
          from,
          at: row.created_at,
        });
      }
      for (const file of parsed.files) {
        items.push({ kind: 'file', name: file.name, from, at: row.created_at });
      }
    }
    for (const url of linksIn(text)) {
      if (seenLinks.has(url)) {
        continue;
      }
      seenLinks.add(url);
      items.push({
        kind: SHOT.test(url) ? 'picture' : 'link',
        name: url.replace(/^https?:\/\//, '').slice(0, 120),
        url,
        from,
        at: row.created_at,
      });
    }
    if (items.length >= LIBRARY_MAX_ITEMS) {
      break;
    }
  }
  return items.slice(0, LIBRARY_MAX_ITEMS);
}
