/**
 * Orders: the record a seller and a buyer can look up.
 *
 * Before this an order had no screen at all — a seller learned of a sale from
 * a notification, and a purchase made without an account was not an order.
 */
import { listMyOrders, orderRef } from '@/domain/commerce/orders';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createFakeSupabase } from '../../../test-utils/fakeSupabase';

const ME = 'user-me';
const order = (over: Record<string, unknown>) => ({
  id: 'ab12cd34-0000-0000-0000-000000000000',
  payment_intent_id: 'pi-1',
  booking_id: null,
  buyer_id: 'user-buyer',
  seller_id: ME,
  entity_type: 'product',
  entity_id: 'prod-1',
  entity_title: 'Morning with Cat',
  amount_btc: '0.00034628',
  status: 'paid',
  buyer_note: null,
  created_at: '2026-11-13T10:00:00Z',
  ...over,
});

const db = (orders: Record<string, unknown>[]) =>
  createFakeSupabase({
    [DATABASE_TABLES.ORDERS]: orders,
    [DATABASE_TABLES.PAYMENT_INTENTS]: [
      { id: 'pi-1', guest_name: null, paid_at: '2026-11-13T10:01:00Z' },
      { id: 'pi-guest', guest_name: 'Ana', paid_at: '2026-11-13T11:00:00Z' },
    ],
    [DATABASE_TABLES.PROFILES]: [
      { id: 'user-buyer', username: 'lena', name: 'Lena Brunner' },
      { id: 'user-seller', username: 'cato', name: null },
    ],
  });

describe('listMyOrders', () => {
  it('shows a seller the buyer without an account: the name they gave and their note', async () => {
    const { client } = db([
      order({ payment_intent_id: 'pi-guest', buyer_id: null, buyer_note: ' ana@example.org ' }),
    ]);
    const [o] = await listMyOrders(client, ME);
    expect(o).toMatchObject({
      role: 'seller',
      guest: true,
      counterpartyName: 'Ana',
      counterpartyUsername: null,
      buyerNote: 'ana@example.org',
      amountBtc: 0.00034628,
      ref: 'AB12CD34',
      paidAt: '2026-11-13T11:00:00Z',
    });
  });

  it('names the other side from their profile, on both sides', async () => {
    const { client } = db([
      order({ id: 'o-sold' }),
      order({ id: 'o-bought', buyer_id: ME, seller_id: 'user-seller' }),
    ]);
    const orders = await listMyOrders(client, ME);
    expect(orders.find(o => o.id === 'o-sold')).toMatchObject({
      role: 'seller',
      guest: false,
      counterpartyName: 'Lena Brunner',
      counterpartyUsername: 'lena',
    });
    expect(orders.find(o => o.id === 'o-bought')).toMatchObject({
      role: 'buyer',
      guest: false,
      counterpartyName: 'cato',
    });
  });

  it('leaves out a checkout nobody paid, and other people’s orders', async () => {
    const { client } = db([
      order({ id: 'o-unpaid', status: 'pending_payment' }),
      order({ id: 'o-cancelled', status: 'cancelled' }),
      order({ id: 'o-theirs', seller_id: 'x', buyer_id: 'y' }),
      order({ id: 'o-shipped', status: 'shipped' }),
    ]);
    expect((await listMyOrders(client, ME)).map(o => o.id)).toEqual(['o-shipped']);
  });

  it('carries the booking an order paid for', async () => {
    const { client } = db([order({ booking_id: 'booking-1' })]);
    expect((await listMyOrders(client, ME))[0].bookingId).toBe('booking-1');
  });

  it('quotes one reference for both sides', () => {
    expect(orderRef('ab12cd34-ffff-0000-0000-000000000000')).toBe('AB12CD34');
  });
});
