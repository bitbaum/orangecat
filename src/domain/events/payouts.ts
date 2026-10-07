/**
 * Money out of an event: paying the crew and refunding tickets.
 *
 * OrangeCat holds no money. The organizer pays from their own connected
 * wallet through the same rail as the Send screen (sendToRecipient — which
 * also writes OrangeCat's audit record of the send). This module adds the two
 * things an event needs on top: the rules (only the organizer; only someone
 * on the crew; never twice) and the event's own record of who was paid what,
 * which the organizer and the person paid can both read.
 *
 * "Paid another way" is recorded too (method 'other'): Twint and cash are how
 * a lot of crews are paid, and a record that pretends otherwise is wrong.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { STATUS } from '@/config/database-constants';
import { EVENT_PAYOUT_NOTE_MAX, type EventPayoutMethod } from '@/config/event-payouts';
import { sendToRecipient } from '@/domain/payments/sendPaymentService';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { looseClient } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { ROUTES } from '@/config/routes';
import type { EventRole } from './crew';

/** A refusal with a sentence the organizer can act on. */
export class PayoutError extends Error {
  constructor(
    message: string,
    readonly code: 'forbidden' | 'not_found' | 'invalid' | 'already' | 'send_failed'
  ) {
    super(message);
  }
}

export interface EventPayout {
  id: string;
  kind: 'crew' | 'refund';
  role_id: string | null;
  attendee_id: string | null;
  recipient_user_id: string;
  amount: number | null;
  currency: string | null;
  amount_btc: number | null;
  method: EventPayoutMethod;
  status: 'sent' | 'failed';
  note: string | null;
  created_at: string;
}

interface Ctx {
  /** The organizer's own client (RLS as them). */
  supabase: AnySupabaseClient;
  /** System client, for the writes made after the organizer was checked. */
  admin: AnySupabaseClient;
  organizerId: string;
}

async function organizerEvent(ctx: Ctx, eventId: string) {
  const { data: event } = await ctx.supabase
    .from(ENTITY_REGISTRY.event.tableName)
    .select('id, title, user_id, currency')
    .eq('id', eventId)
    .maybeSingle();
  if (!event) {
    throw new PayoutError('Event not found', 'not_found');
  }
  if (event.user_id !== ctx.organizerId) {
    throw new PayoutError('Only the organizer can pay from this event', 'forbidden');
  }
  return event as { id: string; title: string; currency: string | null };
}

async function usernameOf(admin: AnySupabaseClient, userId: string): Promise<string> {
  const { data } = await admin
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', userId)
    .maybeSingle();
  if (!data?.username) {
    throw new PayoutError('That person has no OrangeCat username to pay', 'not_found');
  }
  return data.username as string;
}

async function record(
  ctx: Ctx,
  row: Omit<EventPayout, 'id' | 'created_at'> & { event_id: string; payment_hash?: string | null }
) {
  const { data, error } = await looseClient(ctx.admin)
    .from(DATABASE_TABLES.EVENT_PAYOUTS)
    .insert({ ...row, created_by: ctx.organizerId })
    .select('*')
    .single();
  if (error) {
    // The money may already have moved; never hide that the record failed.
    throw new PayoutError(`Paid, but the record could not be saved: ${error.message}`, 'invalid');
  }
  return data as EventPayout;
}

const cleanNote = (note: unknown) =>
  typeof note === 'string' && note.trim() ? note.trim().slice(0, EVENT_PAYOUT_NOTE_MAX) : null;

/**
 * Pay one person on the crew their role's fee.
 * 'lightning': sent now from the organizer's wallet. 'other': the organizer
 * paid outside OrangeCat and is recording it.
 */
export async function payCrewMember(
  ctx: Ctx,
  params: { roleId: string; recipientUserId: string; method: EventPayoutMethod; note?: unknown }
): Promise<EventPayout> {
  const { data: roleRow } = await ctx.supabase
    .from(DATABASE_TABLES.EVENT_ROLES)
    .select('id, event_id, role_title, fee_amount, assignee_user_ids')
    .eq('id', params.roleId)
    .maybeSingle();
  if (!roleRow) {
    throw new PayoutError('Role not found', 'not_found');
  }
  const role = roleRow as Pick<
    EventRole,
    'id' | 'event_id' | 'role_title' | 'fee_amount' | 'assignee_user_ids'
  >;
  const event = await organizerEvent(ctx, role.event_id);
  if (!role.assignee_user_ids.includes(params.recipientUserId)) {
    throw new PayoutError(`They are not on the crew as ${role.role_title}`, 'invalid');
  }

  const { data: earlier } = await ctx.admin
    .from(DATABASE_TABLES.EVENT_PAYOUTS)
    .select('id')
    .eq('kind', 'crew')
    .eq('role_id', role.id)
    .eq('recipient_user_id', params.recipientUserId)
    .eq('status', 'sent')
    .maybeSingle();
  if (earlier) {
    throw new PayoutError('Already paid for this role', 'already');
  }

  const fee = Number(role.fee_amount ?? NaN);
  const currency = event.currency || 'CHF';
  const hasFee = Number.isFinite(fee) && fee > 0;
  const base = {
    event_id: event.id,
    kind: 'crew' as const,
    role_id: role.id,
    attendee_id: null,
    recipient_user_id: params.recipientUserId,
    amount: hasFee ? fee : null,
    currency: hasFee ? currency : null,
    note: cleanNote(params.note),
  };

  if (params.method === 'other') {
    const row = await record(ctx, { ...base, amount_btc: null, method: 'other', status: 'sent' });
    await notifyPaid(params.recipientUserId, event, 'crew', 'recorded');
    return row;
  }

  if (!hasFee) {
    throw new PayoutError(`Set a fee for ${role.role_title} first`, 'invalid');
  }
  const amountBtc = await convertToBtcOrNull(fee, currency);
  if (amountBtc === null) {
    throw new PayoutError(
      `No Bitcoin rate for ${currency} right now — try again shortly`,
      'invalid'
    );
  }
  const username = await usernameOf(ctx.admin, params.recipientUserId);
  const sent = await sendToRecipient(
    ctx.organizerId,
    username,
    amountBtc,
    `${role.role_title} — ${event.title}`
  );
  if (!sent.ok) {
    await record(ctx, {
      ...base,
      amount_btc: amountBtc,
      method: 'lightning',
      status: 'failed',
      note: sent.message,
    });
    throw new PayoutError(sent.message, 'send_failed');
  }
  const row = await record(ctx, {
    ...base,
    amount_btc: amountBtc,
    method: 'lightning',
    status: 'sent',
    payment_hash: sent.paymentHash,
  });
  await notifyPaid(params.recipientUserId, event, 'crew', 'sent');
  return row;
}

/**
 * Refund a paid ticket: what the buyer paid for it goes back from the
 * organizer's wallet ('lightning') or was given back another way ('other');
 * either way the ticket is cancelled and its seat freed.
 */
export async function refundTicket(
  ctx: Ctx,
  params: { eventId: string; attendeeId: string; method: EventPayoutMethod; note?: unknown }
): Promise<EventPayout> {
  const event = await organizerEvent(ctx, params.eventId);
  const { data: ticket } = await ctx.supabase
    .from(DATABASE_TABLES.EVENT_ATTENDEES)
    .select('id, user_id, payment_status')
    .eq('id', params.attendeeId)
    .eq('event_id', event.id)
    .maybeSingle();
  if (!ticket || ticket.payment_status !== 'paid') {
    throw new PayoutError('No paid ticket to refund', 'not_found');
  }
  const buyerId = ticket.user_id as string;

  // What they paid: every settled ticket payment for this event by this buyer.
  const { data: intents } = await ctx.admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('id, amount_btc')
    .eq('entity_type', 'event')
    .eq('entity_id', event.id)
    .eq('buyer_id', buyerId)
    .eq('status', STATUS.PAYMENT_INTENTS.PAID);
  const paid = (intents ?? []) as Array<{ id: string; amount_btc: number }>;
  const amountBtc = paid.reduce((sum, p) => sum + Number(p.amount_btc || 0), 0);

  const base = {
    event_id: event.id,
    kind: 'refund' as const,
    role_id: null,
    attendee_id: ticket.id as string,
    recipient_user_id: buyerId,
    amount: null,
    currency: null,
    note: cleanNote(params.note),
  };

  let paymentHash: string | null = null;
  if (params.method === 'lightning') {
    if (!(amountBtc > 0)) {
      throw new PayoutError(
        'No settled payment found for this ticket — refund it another way',
        'invalid'
      );
    }
    const username = await usernameOf(ctx.admin, buyerId);
    const sent = await sendToRecipient(
      ctx.organizerId,
      username,
      amountBtc,
      `Refund — ${event.title}`
    );
    if (!sent.ok) {
      await record(ctx, {
        ...base,
        amount_btc: amountBtc,
        method: 'lightning',
        status: 'failed',
        note: sent.message,
      });
      throw new PayoutError(sent.message, 'send_failed');
    }
    paymentHash = sent.paymentHash;
  }

  const { error } = await ctx.supabase.rpc('refund_ticket', {
    p_event_id: event.id,
    p_attendee_id: ticket.id,
  });
  if (error) {
    if (paymentHash) {
      // The money already went back; the record must say so even though the
      // ticket could not be cancelled (someone else refunded it meanwhile).
      await record(ctx, {
        ...base,
        amount_btc: amountBtc,
        method: 'lightning',
        status: 'sent',
        payment_hash: paymentHash,
        note: `Sent, but the ticket was not cancelled: ${error.message}`.slice(
          0,
          EVENT_PAYOUT_NOTE_MAX
        ),
      });
    }
    throw new PayoutError(error.message, 'invalid');
  }
  if (paid.length > 0) {
    await ctx.admin
      .from(DATABASE_TABLES.ORDERS)
      .update({ status: STATUS.ORDERS.REFUNDED })
      .in(
        'payment_intent_id',
        paid.map(p => p.id)
      );
  }
  const row = await record(ctx, {
    ...base,
    amount_btc: amountBtc > 0 ? amountBtc : null,
    method: params.method,
    status: 'sent',
    payment_hash: paymentHash,
  });
  await notifyPaid(buyerId, event, 'refund', params.method === 'lightning' ? 'sent' : 'recorded');
  return row;
}

/** Everything paid out of an event, newest first — organizer's view (RLS). */
export async function listPayouts(
  supabase: AnySupabaseClient,
  eventId: string
): Promise<EventPayout[]> {
  const { data } = await supabase
    .from(DATABASE_TABLES.EVENT_PAYOUTS)
    .select(
      'id, kind, role_id, attendee_id, recipient_user_id, amount, currency, amount_btc, method, status, note, created_at'
    )
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  return (data ?? []) as EventPayout[];
}

async function notifyPaid(
  userId: string,
  event: { id: string; title: string },
  what: 'crew' | 'refund',
  how: 'sent' | 'recorded'
) {
  const sentence = {
    crew: {
      sent: 'your crew fee was sent to your wallet.',
      recorded: 'the organizer recorded paying your crew fee outside OrangeCat.',
    },
    refund: {
      sent: 'your ticket was refunded to your wallet.',
      recorded:
        'your ticket was cancelled and the organizer gave the money back outside OrangeCat.',
    },
  }[what][how];
  await NotificationDispatcher.dispatch({
    userId,
    type: 'payment',
    title: what === 'refund' ? 'Ticket refunded' : 'Crew fee paid',
    message: `${event.title}: ${sentence}`,
    actionUrl: ROUTES.EVENTS.VIEW(event.id),
    sourceEntityType: 'event',
    sourceEntityId: event.id,
  });
}
