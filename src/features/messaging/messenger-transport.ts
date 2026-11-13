'use client';

/**
 * OrangeCat's backend, as the packaged Messenger speaks to it.
 *
 * The Messenger (`@bitbaum/chatkit/messenger`) owns the screen and its
 * behaviour; this file is everything it does not know: which routes hold the
 * conversations, how a file gets to storage, which realtime channels say that
 * something happened. Nothing here draws anything.
 *
 * Realtime is an improvement, never a dependency: every channel failure is
 * caught, and the Messenger reloads on its own when the tab comes back. A
 * dropped socket costs seconds, not messages.
 */

import {
  MessengerError,
  mentionMatcher,
  reviveConversation,
  reviveMessage,
  type MessengerAttachment,
  type MessengerCard,
  type MessengerEvent,
  type MessengerPerson,
  type MessengerTransport,
} from '@bitbaum/chatkit/messenger';
import { API_ROUTES } from '@/config/api-routes';
import { CAT_MENTION, CAT_USERNAME } from '@/config/cat-identity';
import { DATABASE_TABLES } from '@/config/database-tables';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { namedBots } from './lib/named-bots';
import {
  toMessengerAttachment,
  toMessengerConversation,
  toMessengerMessage,
} from './lib/messenger-mapping';
import { rankPeopleForPicker, type PickerPerson } from './people-picker';
import type { MessageAttachmentDto } from './server/attachments';
import type { Conversation, Message } from './types';

export interface MessengerTransportOptions {
  /** The signed-in user: the id their own messages carry. */
  userId: string;
  /** The identity the viewer is writing as, when it is not themselves (a
   *  group they administer). Read at send time. */
  senderActorId?: () => string | null;
  /** Something about what is unread may have changed (the nav's badge). */
  onUnreadMayHaveChanged?: () => void;
}

const PAGE = 50;
/** How long "is typing" lives without being renewed (the row's expires_at). */
const TYPING_TTL_MS = 8_000;
/** How a bot is named in the people list, so `open` can tell it from a person. */
export const BOT_PERSON_PREFIX = 'bot:';
/** While a bot is answering: how often "is typing" is renewed, and for how long. */
const BOT_TYPING_EVERY_MS = 4_000;
const BOT_TYPING_FOR_MS = 60_000;
/** After the Cat is tagged: when to look for its answer if no push arrives. */
const CAT_CHECKS_MS = [4_000, 9_000, 16_000, 30_000, 55_000];

type Envelope<T> = { success?: boolean; data?: T; error?: unknown };

/** A request to this app's API. A refusal the server worded for the person
 *  (a rate limit, a quota) reaches them; anything else is the Messenger's. */
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
  });
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload?.data) {
    const worded = response.status >= 400 && response.status < 500 && response.status !== 404;
    const message = apiErrorMessage(payload, '');
    if (worded && message) {
      throw new MessengerError(message);
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return payload.data;
}

/** Send bytes to a signed storage URL, reporting how far they have got. */
function putToStorage(
  url: string,
  file: Blob,
  name: string,
  control: { progress?: (fraction: number) => void; signal?: AbortSignal }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const form = new FormData();
    // storage-api's signed-upload contract: the cache lifetime as a field,
    // then the file as the unnamed part. A file on a message never changes,
    // so it is cacheable for as long as a link to it works.
    form.append('cacheControl', '31536000');
    form.append('', file, name);
    request.open('PUT', url);
    request.setRequestHeader('x-upsert', 'false');
    request.upload.onprogress = event => {
      if (event.lengthComputable) {
        control.progress?.(event.loaded / event.total);
      }
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Storage refused the upload (${request.status})`));
    request.onerror = () => reject(new Error('The upload did not reach storage'));
    request.onabort = () => reject(new Error('Upload cancelled'));
    control.signal?.addEventListener('abort', () => request.abort(), { once: true });
    request.send(form);
  });
}

/** The payment request a card was made for (set by the "Request money" action). */
export function paymentRequestIdOfCard(card: MessengerCard | undefined): string | undefined {
  const id = card?.data?.paymentRequestId;
  return typeof id === 'string' && id ? id : undefined;
}

/** The viewer's own companions whose name matches what was typed. */
async function ownBots(
  userId: string,
  query: string,
  signal?: AbortSignal
): Promise<MessengerPerson[]> {
  const response = await fetch(
    `${API_ROUTES.AI_ASSISTANTS.BASE}?limit=50&user_id=${encodeURIComponent(userId)}`,
    { credentials: 'same-origin', signal }
  );
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as {
    data?: Array<{ id: string; title?: string | null; avatar_url?: string | null }>;
  };
  const asked = query.trim().toLowerCase();
  return (Array.isArray(payload.data) ? payload.data : [])
    .filter(bot => (bot.title ?? '').toLowerCase().includes(asked))
    .map(bot => ({
      id: `${BOT_PERSON_PREFIX}${bot.id}`,
      name: bot.title?.trim() || 'Bot',
      avatarUrl: bot.avatar_url ?? null,
      kind: 'agent' as const,
    }));
}

export function createMessengerTransport(options: MessengerTransportOptions): MessengerTransport {
  const { userId } = options;
  const listeners = new Set<(event: MessengerEvent) => void>();
  const emit = (event: MessengerEvent) => listeners.forEach(on => on(event));
  const mentionsCat = mentionMatcher([CAT_MENTION]);

  // The bots of each conversation (ADR-0015), so the thread can say a bot is
  // writing from the moment it is owed an answer: always when it is the only
  // other member, and when it is named where there are more voices. The Cat
  // is left out: it has its own "is thinking".
  const botsOf = new Map<string, { direct: boolean; bots: Array<{ id: string; name: string }> }>();
  const learn = (conversation: Conversation) => {
    const others = (conversation.participants ?? []).filter(
      p => p.user_id !== userId && p.is_active !== false
    );
    const bots = others
      .filter(p => p.is_agent && p.username !== CAT_USERNAME)
      .map(p => ({ id: p.user_id, name: p.name || p.username }));
    if (bots.length === 0) {
      botsOf.delete(conversation.id);
    } else {
      botsOf.set(conversation.id, { direct: others.length === 1, bots });
    }
  };
  /** The bots a message is owed an answer from: the server's own rule. */
  const owedBy = (conversationId: string, body: string) => {
    const here = botsOf.get(conversationId);
    if (!here || !body.trim()) {
      return [];
    }
    return here.direct ? here.bots : namedBots(body, here.bots);
  };
  const writing = new Map<string, ReturnType<typeof setInterval>>();
  const stopWriting = (conversationId: string, bot: string) => {
    const key = `${conversationId}:${bot}`;
    const timer = writing.get(key);
    if (!timer) {
      return;
    }
    clearInterval(timer);
    writing.delete(key);
    emit({ type: 'typing', conversationId, actorId: bot, typing: false });
  };
  const startWriting = (conversationId: string, bot: string) => {
    stopWriting(conversationId, bot);
    const until = Date.now() + BOT_TYPING_FOR_MS;
    const say = () => {
      if (Date.now() > until) {
        stopWriting(conversationId, bot);
        return;
      }
      emit({ type: 'typing', conversationId, actorId: bot, typing: true });
    };
    say();
    writing.set(`${conversationId}:${bot}`, setInterval(say, BOT_TYPING_EVERY_MS));
  };

  const loadPage = async (conversationId: string, before?: string, signal?: AbortSignal) => {
    const query = new URLSearchParams({ limit: String(PAGE) });
    if (before) {
      query.set('cursor', before);
    }
    const data = await api<{
      conversation: Conversation;
      messages: Message[];
      pagination: { hasMore: boolean; nextCursor: string | null };
    }>(`${API_ROUTES.MESSAGES.CONVERSATION(conversationId)}?${query}`, { signal });
    // The page comes with the conversation as it is now: who is in it, how
    // far each has read. The list learns it for free.
    if (data.conversation?.id) {
      learn(data.conversation);
      emit({
        type: 'conversation',
        conversation: reviveConversation(toMessengerConversation(data.conversation)),
      });
    }
    return {
      messages: (data.messages ?? []).map(m => reviveMessage(toMessengerMessage(m, userId))),
      before: data.pagination?.hasMore ? data.pagination.nextCursor : null,
    };
  };

  /** One message with its sender and files, as the API shapes it. */
  const pushLatest = async (conversationId: string) => {
    try {
      const page = await loadPage(conversationId);
      for (const message of page.messages) {
        emit({ type: 'message', message });
      }
      // A bot that has answered is no longer writing. Only the messages
      // after the viewer's own newest one count: an older answer of the same
      // bot must not end the wait for this one.
      const ownNewest = page.messages.map(m => m.authorId).lastIndexOf(userId);
      for (const message of page.messages.slice(ownNewest + 1)) {
        stopWriting(conversationId, message.authorId);
      }
    } catch {
      // The next push, or the tab coming back, brings it.
    }
  };

  const transport: MessengerTransport = {
    async conversations({ signal }) {
      const data = await api<{ conversations: Conversation[] }>(
        `${API_ROUTES.MESSAGES.BASE}?limit=100`,
        { signal }
      );
      (data.conversations ?? []).forEach(learn);
      return (data.conversations ?? []).map(c => reviveConversation(toMessengerConversation(c)));
    },

    async conversation(id, { signal }) {
      const data = await api<{ conversation: Conversation }>(
        API_ROUTES.MESSAGES.CONVERSATION_SUMMARY(id),
        { signal }
      );
      learn(data.conversation);
      return reviveConversation(toMessengerConversation(data.conversation));
    },

    messages(conversationId, { before, signal }) {
      return loadPage(conversationId, before, signal);
    },

    async send(conversationId, draft) {
      const data = await api<{ id: string; attachments?: MessageAttachmentDto[] }>(
        API_ROUTES.MESSAGES.CONVERSATION(conversationId),
        {
          method: 'POST',
          body: JSON.stringify({
            content: draft.body,
            clientId: draft.clientId,
            attachmentIds: draft.attachments.map(a => a.id),
            senderActorId: options.senderActorId?.() ?? undefined,
            replyToId: draft.replyTo?.id,
            paymentRequestId: paymentRequestIdOfCard(draft.card),
          }),
        }
      );
      const owed = owedBy(conversationId, draft.body);
      if (owed.length > 0) {
        // A push normally brings each answer; these looks are for when the
        // push does not arrive.
        owed.forEach(bot => startWriting(conversationId, bot.id));
        for (const delay of CAT_CHECKS_MS) {
          setTimeout(() => void pushLatest(conversationId), delay);
        }
      }
      if (mentionsCat(draft.body)) {
        // The Cat answers from a worker. A push normally brings its reply in
        // seconds; these looks are for the times the push does not arrive.
        for (const delay of CAT_CHECKS_MS) {
          setTimeout(() => void pushLatest(conversationId), delay);
        }
      }
      return {
        id: data.id,
        clientId: draft.clientId,
        threadId: conversationId,
        authorId: userId,
        body: draft.body,
        createdAt: new Date(),
        ...(draft.attachments.length > 0
          ? { attachments: data.attachments?.map(toMessengerAttachment) ?? [...draft.attachments] }
          : {}),
        ...(draft.replyTo ? { replyTo: draft.replyTo } : {}),
        ...(draft.card ? { card: draft.card } : {}),
      };
    },

    async react(message, emoji) {
      await api<{ saved: boolean }>(API_ROUTES.MESSAGES.REACTIONS, {
        method: 'PUT',
        body: JSON.stringify({ messageId: message.id, emoji }),
      });
    },

    async edit(message, body) {
      await api<{ message: unknown }>(API_ROUTES.MESSAGES.EDIT(message.id), {
        method: 'PATCH',
        body: JSON.stringify({ content: body }),
      });
      return { ...message, body, editedAt: new Date() };
    },

    async remove(message) {
      await api<{ deleted: number }>(API_ROUTES.MESSAGES.BULK_DELETE, {
        method: 'POST',
        body: JSON.stringify({ conversationId: message.threadId, ids: [message.id] }),
      });
    },

    async markRead(conversationId) {
      await api<{ success: boolean }>(API_ROUTES.MESSAGES.CONVERSATION_READ(conversationId), {
        method: 'POST',
      });
      options.onUnreadMayHaveChanged?.();
    },

    typing(conversationId, typing) {
      const table = supabase.from(DATABASE_TABLES.TYPING_INDICATORS);
      const write = typing
        ? table.upsert(
            {
              conversation_id: conversationId,
              user_id: userId,
              started_at: new Date().toISOString(),
              // Readers select rows that have not expired, so a closed tab
              // stops "typing" by itself.
              expires_at: new Date(Date.now() + TYPING_TTL_MS).toISOString(),
            },
            { onConflict: 'conversation_id,user_id' }
          )
        : table.delete().eq('conversation_id', conversationId).eq('user_id', userId);
      // Fire-and-forget: nobody should wait on, or be told about, a missed "typing".
      void Promise.resolve(write).then(
        () => undefined,
        () => undefined
      );
    },

    async upload(file, about, control) {
      const started = await api<{
        attachment: MessageAttachmentDto;
        upload: { url: string };
        poster: { url: string } | null;
      }>(API_ROUTES.MESSAGES.ATTACHMENTS, {
        method: 'POST',
        signal: control.signal,
        body: JSON.stringify({
          conversationId: about.conversationId,
          name: about.name,
          mimeType: about.mimeType,
          bytes: about.bytes,
          width: about.width,
          height: about.height,
          durationMs: about.durationMs,
          poster: Boolean(about.poster),
        }),
      });
      await putToStorage(started.upload.url, file, about.name, control);
      if (about.poster && started.poster) {
        // A video without its still is still a video: never fail the upload
        // for the picture of it.
        await putToStorage(started.poster.url, about.poster, 'poster.jpg', {
          signal: control.signal,
        }).catch(error => {
          logger.warn('Could not upload a video still', { error }, 'Messaging');
        });
      }
      const attachment: MessengerAttachment = toMessengerAttachment(started.attachment);
      return about.poster && started.poster ? attachment : { ...attachment, posterUrl: undefined };
    },

    async usage() {
      return api<{ usedBytes: number }>(API_ROUTES.MESSAGES.ATTACHMENTS);
    },

    async people(query, { signal }) {
      const response = await fetch(
        `${API_ROUTES.PROFILES.BASE}?limit=20&search=${encodeURIComponent(query)}`,
        { credentials: 'same-origin', signal }
      );
      if (!response.ok) {
        throw new Error('Could not search people');
      }
      const payload = (await response.json()) as {
        data?: PickerPerson[] | { data?: PickerPerson[] };
      };
      const found = Array.isArray(payload.data) ? payload.data : (payload.data?.data ?? []);
      const people = rankPeopleForPicker(found, { searching: true, selfId: userId }).map(p => ({
        id: p.id,
        name: p.name?.trim() || p.username || 'Someone',
        handle: p.username ?? undefined,
        avatarUrl: p.avatar_url ?? null,
      }));
      // The viewer's own bots, beside the people: a bot is written to the
      // way a person is (ADR-0015). A list of bots that cannot be read is not
      // a reason to find nobody.
      const bots = await ownBots(userId, query, signal).catch(() => []);
      return [...bots, ...people];
    },

    async open(personIds) {
      const data = await api<{ conversationId: string }>(API_ROUTES.MESSAGES.OPEN, {
        method: 'POST',
        body: JSON.stringify({
          participantIds: personIds.filter(id => !id.startsWith(BOT_PERSON_PREFIX)),
          assistantIds: personIds
            .filter(id => id.startsWith(BOT_PERSON_PREFIX))
            .map(id => id.slice(BOT_PERSON_PREFIX.length)),
        }),
      });
      return transport.conversation!(data.conversationId, {});
    },

    async leave(conversationIds) {
      await api<unknown>(API_ROUTES.MESSAGES.BULK_CONVERSATIONS, {
        method: 'POST',
        body: JSON.stringify({ ids: [...conversationIds], action: 'leave' }),
      });
      options.onUnreadMayHaveChanged?.();
    },

    subscribe(scope, on) {
      listeners.add(on);
      const channels: Array<ReturnType<typeof supabase.channel>> = [];
      const conversationId = scope.conversationId;

      try {
        // The viewer's own seats: a new conversation, or one whose newest
        // message changed, shows up as a change to conversations they are in.
        // RLS decides which rows this subscription can see.
        const list = supabase
          .channel(`messenger-list:${userId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: DATABASE_TABLES.CONVERSATIONS },
            payload => {
              const id = (payload.new as { id?: string } | null)?.id;
              if (!id) {
                return;
              }
              void transport.conversation!(id, {}).then(
                conversation => {
                  emit({ type: 'conversation', conversation });
                  options.onUnreadMayHaveChanged?.();
                },
                () => undefined
              );
            }
          )
          .subscribe(status => {
            if (status === 'SUBSCRIBED') {
              emit({ type: 'connection', state: 'online' });
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              emit({ type: 'connection', state: 'reconnecting' });
            }
          });
        channels.push(list);

        if (conversationId) {
          const filter = `conversation_id=eq.${conversationId}`;
          const thread = supabase
            .channel(`messenger-thread:${conversationId}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: DATABASE_TABLES.MESSAGES, filter },
              () => void pushLatest(conversationId)
            )
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: DATABASE_TABLES.MESSAGES, filter },
              payload => {
                const row = payload.new as { id?: string; is_deleted?: boolean } | null;
                if (row?.id && row.is_deleted) {
                  emit({ type: 'message-removed', conversationId, messageId: row.id });
                } else {
                  void pushLatest(conversationId);
                }
              }
            )
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: DATABASE_TABLES.CONVERSATION_PARTICIPANTS,
                filter,
              },
              payload => {
                const row = payload.new as { user_id?: string; last_read_at?: string } | null;
                if (row?.user_id && row.last_read_at) {
                  emit({
                    type: 'read',
                    conversationId,
                    actorId: row.user_id,
                    at: new Date(row.last_read_at),
                  });
                }
              }
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: DATABASE_TABLES.TYPING_INDICATORS, filter },
              payload => {
                const row = (payload.new ?? payload.old) as {
                  user_id?: string;
                  expires_at?: string;
                } | null;
                if (!row?.user_id || row.user_id === userId) {
                  return;
                }
                const typing =
                  payload.eventType !== 'DELETE' &&
                  (!row.expires_at || new Date(row.expires_at).getTime() > Date.now());
                emit({ type: 'typing', conversationId, actorId: row.user_id, typing });
              }
            )
            .subscribe();
          channels.push(thread);
        }
      } catch (error) {
        logger.warn('Messenger realtime unavailable', { error }, 'Messaging');
      }

      return () => {
        listeners.delete(on);
        for (const channel of channels) {
          void supabase.removeChannel(channel);
        }
      };
    },
  };

  return transport;
}
