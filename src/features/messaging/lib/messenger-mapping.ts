/**
 * OrangeCat's messaging rows, as the packaged Messenger reads them.
 *
 * The Messenger (`@bitbaum/chatkit/messenger`) speaks threadkit's shapes — a
 * thread of participants, messages with an author — and OrangeCat's API speaks
 * its tables. This file is the whole of the translation, pure, so each
 * judgement call below is a unit test and not a guess about what the screen
 * will draw.
 */

import type {
  MessengerAttachment,
  MessengerCard,
  MessengerConversationJson,
  MessengerMessageJson,
} from '@bitbaum/chatkit/messenger';
import { buildPayUrl } from '@/config/pay';
import { formatBTC, formatCurrency } from '@/services/currency/formatting';
import type { MessageAttachmentDto } from '../server/attachments';
import type { Conversation, Message, MessagePaymentRequestDto, Participant } from '../types';

/** Where the client id of an optimistic message rides (messages.metadata). */
export const CLIENT_ID_KEY = 'client_id';

export function toMessengerAttachment(a: MessageAttachmentDto): MessengerAttachment {
  return {
    id: a.id,
    kind: a.kind,
    name: a.name,
    mimeType: a.mime_type,
    bytes: a.bytes,
    width: a.width ?? undefined,
    height: a.height ?? undefined,
    durationMs: a.duration_ms ?? undefined,
    url: a.url,
    posterUrl: a.poster_url ?? undefined,
  };
}

/** What a payment request asks for, in the unit it was asked in. */
export function paymentRequestAmount(request: MessagePaymentRequestDto): string {
  return request.ask_amount !== null && request.ask_currency
    ? formatCurrency(request.ask_amount, request.ask_currency)
    : formatBTC(request.amount_btc);
}

/** Card kind of a payment request in a conversation. */
export const PAYMENT_REQUEST_CARD = 'payment_request';

/**
 * A payment request as the card THIS reader sees. The person asked gets the
 * one thing they can do (pay it, on the pay page, tied to the request so it is
 * marked paid); the person asking is told where it stands. Nobody is offered
 * to pay a request that is no longer open.
 */
export function toPaymentRequestCard(
  request: MessagePaymentRequestDto,
  viewerId: string | undefined,
  requesterUsername: string | undefined
): MessengerCard {
  const amount = paymentRequestAmount(request);
  const card: MessengerCard = {
    kind: PAYMENT_REQUEST_CARD,
    title: 'Payment request',
    amount,
    ...(request.note ? { note: request.note } : {}),
  };
  switch (request.status) {
    case 'paid':
      return { ...card, status: 'Paid', tone: 'positive' };
    case 'declined':
      return { ...card, status: 'Declined', tone: 'negative' };
    case 'cancelled':
      return { ...card, status: 'Cancelled', tone: 'negative' };
    case 'pending':
      if (viewerId === request.payer_id && requesterUsername) {
        const url = new URL(
          buildPayUrl('https://orangecat.invalid', requesterUsername, {
            amountBtc: request.amount_btc,
            note: request.note ?? undefined,
            requestId: request.id,
          })
        );
        return {
          ...card,
          tone: 'pending',
          action: { label: `Pay ${amount}`, href: `${url.pathname}${url.search}` },
        };
      }
      return { ...card, status: 'Waiting to be paid', tone: 'pending' };
  }
}

/** `viewerId` decides what a card offers; without it a card only informs. */
export function toMessengerMessage(message: Message, viewerId?: string): MessengerMessageJson {
  const meta = message.metadata ?? {};
  const clientId = meta[CLIENT_ID_KEY];
  const requestedBy = meta.requested_by;
  return {
    id: message.id,
    threadId: message.conversation_id,
    authorId: message.sender_id,
    body: message.content ?? '',
    createdAt: message.created_at,
    editedAt: message.edited_at,
    ...(typeof clientId === 'string' && clientId ? { clientId } : {}),
    // The Cat answers FOR the person who tagged it; the thread says so.
    ...(typeof requestedBy === 'string' && requestedBy ? { onBehalfOf: requestedBy } : {}),
    ...(message.attachments && message.attachments.length > 0
      ? { attachments: message.attachments.map(toMessengerAttachment) }
      : {}),
    ...(message.reply_to
      ? {
          replyTo: {
            id: message.reply_to.id,
            authorId: message.reply_to.sender_id,
            body: message.reply_to.body,
            ...(message.reply_to.kinds ? { attachments: message.reply_to.kinds } : {}),
          },
        }
      : {}),
    ...(message.reactions && message.reactions.length > 0
      ? { reactions: message.reactions.map(r => ({ emoji: r.emoji, actorIds: r.user_ids })) }
      : {}),
    ...(message.payment_request
      ? {
          card: toPaymentRequestCard(
            message.payment_request,
            viewerId,
            message.sender?.username || undefined
          ),
        }
      : {}),
  };
}

function toMessengerParticipant(p: Participant): MessengerConversationJson['participants'][number] {
  return {
    actorId: p.user_id,
    // The Cat is an agent and is shown as one. `kind` is descriptive only:
    // nothing about who may read or write follows from it.
    kind: p.is_agent ? 'ai' : 'human',
    role: p.role,
    name: p.name || p.username || 'Someone',
    handle: p.username || undefined,
    avatarUrl: p.avatar_url,
    joinedAt: p.joined_at,
    // History is shared here: everyone in a conversation can scroll to its
    // top. threadkit's default (from the day you joined) would hide what
    // people can read today.
    visibleFrom: 'thread-start',
    // Someone who took the conversation off their list has lost their voice
    // in it, not their place: it is still a conversation with them. The row
    // does not say WHEN they left, so no `leftAt` is invented.
    canWrite: p.is_active,
    lastReadAt: p.last_read_at || null,
  };
}

export function toMessengerConversation(conversation: Conversation): MessengerConversationJson {
  const title = conversation.title?.trim();
  // `last_message_at` defaults to the conversation's creation, so a
  // conversation nobody has written in has a time and no words: that is "no
  // newest message", not an empty one.
  const hasLast = conversation.last_message_at && conversation.last_message_preview !== null;
  return {
    id: conversation.id,
    createdAt: conversation.created_at ?? conversation.last_message_at,
    // A direct conversation is called by the person in it, never by a stored
    // title; a group keeps the name it was given.
    ...(conversation.is_group && title ? { subject: title } : {}),
    participants: conversation.participants.map(toMessengerParticipant),
    last: hasLast
      ? {
          body: conversation.last_message_preview ?? '',
          authorId: conversation.last_message_sender_id ?? '',
          createdAt: conversation.last_message_at as string,
        }
      : null,
    unread: conversation.unread_count ?? 0,
  };
}

/** The Cat's seat in a conversation, if it has one. */
export function agentOf(conversation: Conversation): Participant | undefined {
  return conversation.participants.find(p => p.is_agent);
}
