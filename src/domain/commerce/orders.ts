/**
 * Orders — the record of a purchase, for the two people it is between.
 *
 * An order is written with every purchase (signed in, without an account, or
 * as the payment of an accepted booking) and marked paid by settlement. It had
 * no screen: a seller learned of a sale from a notification and could not look
 * it up, and a buyer's receipt said "Your order has been placed" and led
 * nowhere. This reads them through RLS ("Orders viewable by buyer or seller"),
 * so each person sees exactly the orders they are a side of.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { fromTable } from '@/lib/supabase/untyped';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** The short reference both sides can quote: the order's id, first group. */
export function orderRef(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}

type OrderStatus = (typeof STATUS.ORDERS)[keyof typeof STATUS.ORDERS];

/**
 * An order that was never paid is an abandoned checkout, not something either
 * side has to act on, so it is not listed.
 */
const LISTED_STATUSES: OrderStatus[] = [
  STATUS.ORDERS.PAID,
  STATUS.ORDERS.SHIPPED,
  STATUS.ORDERS.COMPLETED,
  STATUS.ORDERS.REFUNDED,
];

export interface MyOrder {
  id: string;
  ref: string;
  /** Which side the reader is on. */
  role: 'seller' | 'buyer';
  title: string;
  entityType: string;
  entityId: string;
  amountBtc: number;
  status: OrderStatus;
  /** The other side's name; for a buyer without an account, the name they gave. */
  counterpartyName: string | null;
  counterpartyUsername: string | null;
  /** The buyer had no account: there is no profile to open or message. */
  guest: boolean;
  /** What the buyer wrote for the seller (how to reach them, where to send it). */
  buyerNote: string | null;
  /** The booking this order paid for, when it was one. */
  bookingId: string | null;
  paidAt: string | null;
  createdAt: string | null;
}

interface OrderRow {
  id: string;
  payment_intent_id: string;
  booking_id: string | null;
  buyer_id: string | null;
  seller_id: string;
  entity_type: string;
  entity_id: string;
  entity_title: string;
  amount_btc: number | string;
  status: OrderStatus;
  buyer_note: string | null;
  created_at: string | null;
}

const ORDER_COLUMNS =
  'id, payment_intent_id, booking_id, buyer_id, seller_id, entity_type, entity_id, entity_title, amount_btc, status, buyer_note, created_at';

export async function listMyOrders(
  supabase: AnySupabaseClient,
  userId: string
): Promise<MyOrder[]> {
  const { data, error } = (await fromTable(supabase, DATABASE_TABLES.ORDERS)
    .select(ORDER_COLUMNS)
    .in('status', LISTED_STATUSES)
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100)) as { data: OrderRow[] | null; error: unknown };
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  if (rows.length === 0) {
    return [];
  }

  const { data: intents } = (await fromTable(supabase, DATABASE_TABLES.PAYMENT_INTENTS)
    .select('id, guest_name, paid_at')
    .in(
      'id',
      rows.map(r => r.payment_intent_id)
    )) as {
    data: Array<{ id: string; guest_name: string | null; paid_at: string | null }> | null;
  };
  const intentById = new Map((intents ?? []).map(i => [i.id, i]));

  const counterpartIds = [
    ...new Set(
      rows
        .map(r => (r.seller_id === userId ? r.buyer_id : r.seller_id))
        .filter((id): id is string => !!id)
    ),
  ];
  const { data: profiles } =
    counterpartIds.length > 0
      ? ((await fromTable(supabase, DATABASE_TABLES.PROFILES)
          .select('id, username, name')
          .in('id', counterpartIds)) as {
          data: Array<{ id: string; username: string | null; name: string | null }> | null;
        })
      : { data: [] };
  const profileById = new Map((profiles ?? []).map(p => [p.id, p]));

  return rows.map(row => {
    const role = row.seller_id === userId ? 'seller' : 'buyer';
    const intent = intentById.get(row.payment_intent_id);
    const counterpartId = role === 'seller' ? row.buyer_id : row.seller_id;
    const profile = counterpartId ? profileById.get(counterpartId) : undefined;
    const guest = role === 'seller' && !row.buyer_id;
    return {
      id: row.id,
      ref: orderRef(row.id),
      role,
      title: row.entity_title,
      entityType: row.entity_type,
      entityId: row.entity_id,
      amountBtc: Number(row.amount_btc),
      status: row.status,
      counterpartyName: guest
        ? intent?.guest_name?.trim() || null
        : profile?.name?.trim() || profile?.username?.trim() || null,
      counterpartyUsername: guest ? null : profile?.username?.trim() || null,
      guest,
      // The note is written for the seller; the buyer wrote it and may reread it.
      buyerNote: row.buyer_note?.trim() || null,
      bookingId: row.booking_id,
      paidAt: intent?.paid_at ?? null,
      createdAt: row.created_at,
    };
  });
}
