/**
 * Where the Cat's chats live: the signed-in person's own rows on the server,
 * behind `API_ROUTES.CAT` — chatkit's `ConversationStore` (six methods) over
 * routes that predate its REST shape.
 *
 * The chat route stores every turn itself (it has to: it runs the tools and
 * writes what they did), so `append` writes nothing — the same contract as
 * `httpConversationStore({ serverWritesTurns: true })`. Nothing a person sends
 * is kept on the device: no message, no picture; ChatApp remembers only which
 * chat was open.
 *
 * Temporary chats never reach this store (ChatApp keeps them in memory); the
 * transport gives each one its own unlisted server row instead
 * (`useCatTransport`).
 */

import type { ConversationStore, ConversationSummary, StoredMessage } from '@bitbaum/chatkit';
import { API_ROUTES } from '@/config/api-routes';
import { readableTitle } from '@/lib/chat/attachment-tags';
import { catMessageFromRow, type StoredCatRow } from '@/lib/chat/cat-messages';

/** A row of `GET /api/cat/conversations`. */
interface CatConversationRow {
  id: string;
  title: string | null;
  updated_at: string;
}

function summary(row: CatConversationRow): ConversationSummary {
  return {
    id: row.id,
    title: row.title ? readableTitle(row.title) : '',
    updatedAt: row.updated_at,
  };
}

async function data<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Cat conversations: ${res.status}`);
  }
  const body = (await res.json()) as { data?: T };
  return body.data as T;
}

export function catConversationStore(fetcher: typeof fetch = fetch): ConversationStore {
  return {
    async list() {
      const res = await fetcher(API_ROUTES.CAT.CONVERSATIONS);
      const body = await data<{ conversations?: CatConversationRow[] }>(res);
      return (body?.conversations ?? []).map(summary);
    },

    async get(id) {
      const res = await fetcher(API_ROUTES.CAT.CONVERSATION(id));
      // Deleted elsewhere (or never this person's): ChatApp drops the row.
      if (res.status === 404) {
        return null;
      }
      const rows = await data<StoredCatRow[]>(res);
      // The Cat's own fields travel on the message untouched (chatkit's contract).
      const messages = (rows ?? []).map(row => catMessageFromRow(row) as StoredMessage);
      return {
        id,
        title: '',
        updatedAt: rows?.[rows.length - 1]?.created_at ?? new Date().toISOString(),
        messages,
      };
    },

    async create(init) {
      const res = await fetcher(API_ROUTES.CAT.CONVERSATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: init?.title || undefined }),
      });
      const body = await data<{ id: string }>(res);
      return { id: body.id, title: init?.title ?? '', updatedAt: new Date().toISOString() };
    },

    // The chat route already stored the turn.
    async append() {},

    async rename(id, title) {
      const res = await fetcher(API_ROUTES.CAT.CONVERSATION(id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      await data(res);
    },

    async remove(id) {
      const res = await fetcher(API_ROUTES.CAT.CONVERSATION(id), { method: 'DELETE' });
      // Already gone is what was asked for.
      if (res.status !== 404) {
        await data(res);
      }
    },
  };
}
