/**
 * Money out of an event: who may pay, whom, how often — and that the record
 * tells the truth when a send fails.
 */
const sendToRecipient = vi.fn();
const convertToBtcOrNull = vi.fn();
const dispatch = vi.fn();

vi.mock('@/domain/payments/sendPaymentService', () => ({
  sendToRecipient: (...a: unknown[]) => sendToRecipient(...a),
}));
vi.mock('@/services/currency/rates.server', () => ({
  convertToBtcOrNull: (...a: unknown[]) => convertToBtcOrNull(...a),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: (...a: unknown[]) => dispatch(...a) },
}));

import { PayoutError, payCrewMember, refundTicket } from '@/domain/events/payouts';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

type Rows = Record<string, unknown>;

/**
 * A client whose reads answer from `reads[table]` and whose writes are
 * captured. Awaiting a chain directly (a list query) yields `lists[table]`.
 */
function fakeClient(reads: Rows, lists: Rows = {}, rpcError: unknown = null) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const updates: Array<{ table: string; row: Record<string, unknown> }> = [];
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: rpcError }));
  const from = vi.fn((table: string) => {
    let inserted: Record<string, unknown> | null = null;
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'order']) {
      chain[m] = vi.fn(() => chain);
    }
    chain.insert = vi.fn((row: Record<string, unknown>) => {
      inserted = row;
      inserts.push({ table, row });
      return chain;
    });
    chain.update = vi.fn((row: Record<string, unknown>) => {
      updates.push({ table, row });
      return chain;
    });
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: reads[table] ?? null, error: null }));
    chain.single = vi.fn(() =>
      Promise.resolve({ data: { id: 'p1', created_at: 'now', ...inserted }, error: null })
    );
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: lists[table] ?? [], error: null }).then(resolve);
    return chain;
  });
  return { client: { from, rpc } as never, inserts, updates, rpc };
}

const EVENT = { id: 'e1', title: 'Electronic night', user_id: 'org', currency: 'CHF' };
const ROLE = {
  id: 'r1',
  event_id: 'e1',
  role_title: 'DJ',
  fee_amount: 200,
  assignee_user_ids: ['dj'],
};

function crewCtx(over: { role?: Rows; earlier?: unknown } = {}) {
  const user = fakeClient({
    [DATABASE_TABLES.EVENT_ROLES]: { ...ROLE, ...over.role },
    [ENTITY_REGISTRY.event.tableName]: EVENT,
  });
  const admin = fakeClient({
    [DATABASE_TABLES.EVENT_PAYOUTS]: over.earlier ?? null,
    [DATABASE_TABLES.PROFILES]: { username: 'djmarco' },
  });
  return { user, admin, ctx: { supabase: user.client, admin: admin.client, organizerId: 'org' } };
}

beforeEach(() => {
  sendToRecipient.mockReset();
  convertToBtcOrNull.mockReset().mockResolvedValue(0.0025);
  dispatch.mockReset().mockResolvedValue(undefined);
});

describe('paying the crew', () => {
  it('sends the fee in Bitcoin from the organizer, records it, tells the DJ', async () => {
    sendToRecipient.mockResolvedValue({ ok: true, paymentHash: 'h1' });
    const { admin, ctx } = crewCtx();
    const payout = await payCrewMember(ctx, {
      roleId: 'r1',
      recipientUserId: 'dj',
      method: 'lightning',
    });
    expect(convertToBtcOrNull).toHaveBeenCalledWith(200, 'CHF');
    expect(sendToRecipient).toHaveBeenCalledWith('org', 'djmarco', 0.0025, 'DJ — Electronic night');
    expect(payout).toMatchObject({ status: 'sent', method: 'lightning', amount: 200 });
    expect(admin.inserts[0].row).toMatchObject({ payment_hash: 'h1', created_by: 'org' });
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'dj' }));
  });

  it('only the organizer can pay', async () => {
    const { ctx } = crewCtx();
    await expect(
      payCrewMember(
        { ...ctx, organizerId: 'someone' },
        {
          roleId: 'r1',
          recipientUserId: 'dj',
          method: 'other',
        }
      )
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(sendToRecipient).not.toHaveBeenCalled();
  });

  it('only someone on the crew', async () => {
    const { ctx } = crewCtx();
    await expect(
      payCrewMember(ctx, { roleId: 'r1', recipientUserId: 'stranger', method: 'other' })
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('never twice', async () => {
    const { ctx } = crewCtx({ earlier: { id: 'old' } });
    await expect(
      payCrewMember(ctx, { roleId: 'r1', recipientUserId: 'dj', method: 'lightning' })
    ).rejects.toMatchObject({ code: 'already' });
    expect(sendToRecipient).not.toHaveBeenCalled();
  });

  it('Bitcoin needs a fee; another way does not', async () => {
    const { ctx } = crewCtx({ role: { fee_amount: null } });
    await expect(
      payCrewMember(ctx, { roleId: 'r1', recipientUserId: 'dj', method: 'lightning' })
    ).rejects.toThrow(/Set a fee/);
    const paid = await payCrewMember(ctx, { roleId: 'r1', recipientUserId: 'dj', method: 'other' });
    expect(paid).toMatchObject({ method: 'other', status: 'sent', amount: null });
  });

  it('a failed send is recorded as failed and reported', async () => {
    sendToRecipient.mockResolvedValue({ ok: false, message: 'Wallet not connected' });
    const { admin, ctx } = crewCtx();
    const err = await payCrewMember(ctx, {
      roleId: 'r1',
      recipientUserId: 'dj',
      method: 'lightning',
    }).catch(e => e);
    expect(err).toBeInstanceOf(PayoutError);
    expect(err.code).toBe('send_failed');
    expect(admin.inserts[0].row).toMatchObject({ status: 'failed', note: 'Wallet not connected' });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('refunding a ticket', () => {
  function refundCtx(ticket: Rows | null, intents: unknown[], rpcError: unknown = null) {
    const user = fakeClient(
      {
        [ENTITY_REGISTRY.event.tableName]: EVENT,
        [DATABASE_TABLES.EVENT_ATTENDEES]: ticket,
      },
      {},
      rpcError
    );
    const admin = fakeClient(
      { [DATABASE_TABLES.PROFILES]: { username: 'guest' } },
      { [DATABASE_TABLES.PAYMENT_INTENTS]: intents }
    );
    return { user, admin, ctx: { supabase: user.client, admin: admin.client, organizerId: 'org' } };
  }
  const PAID = { id: 'a1', user_id: 'guest-id', payment_status: 'paid' };

  it('sends back what was paid, cancels the ticket, marks the order refunded', async () => {
    sendToRecipient.mockResolvedValue({ ok: true, paymentHash: 'h2' });
    const { user, admin, ctx } = refundCtx(PAID, [{ id: 'pi1', amount_btc: 0.0002 }]);
    const payout = await refundTicket(ctx, {
      eventId: 'e1',
      attendeeId: 'a1',
      method: 'lightning',
    });
    expect(sendToRecipient).toHaveBeenCalledWith(
      'org',
      'guest',
      0.0002,
      'Refund — Electronic night'
    );
    expect(user.rpc).toHaveBeenCalledWith('refund_ticket', {
      p_event_id: 'e1',
      p_attendee_id: 'a1',
    });
    expect(admin.updates[0]).toMatchObject({ table: DATABASE_TABLES.ORDERS });
    expect(payout).toMatchObject({ kind: 'refund', amount_btc: 0.0002, payment_hash: 'h2' });
  });

  it('refuses a ticket that was not paid', async () => {
    const { ctx } = refundCtx({ ...PAID, payment_status: 'free' }, []);
    await expect(
      refundTicket(ctx, { eventId: 'e1', attendeeId: 'a1', method: 'other' })
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('cannot send back Bitcoin it has no record of receiving', async () => {
    const { ctx } = refundCtx(PAID, []);
    await expect(
      refundTicket(ctx, { eventId: 'e1', attendeeId: 'a1', method: 'lightning' })
    ).rejects.toThrow(/refund it another way/);
    expect(sendToRecipient).not.toHaveBeenCalled();
  });

  it('keeps a record when the money went back but the ticket could not be cancelled', async () => {
    sendToRecipient.mockResolvedValue({ ok: true, paymentHash: 'h3' });
    const { admin, ctx } = refundCtx(PAID, [{ id: 'pi1', amount_btc: 0.0002 }], {
      message: 'No paid ticket to refund',
    });
    await expect(
      refundTicket(ctx, { eventId: 'e1', attendeeId: 'a1', method: 'lightning' })
    ).rejects.toMatchObject({ code: 'invalid' });
    expect(admin.inserts[0].row).toMatchObject({ payment_hash: 'h3', status: 'sent' });
  });
});

describe('what the person paid is told', () => {
  it('a refund given back another way says so, not "paid you"', async () => {
    const user = fakeClient({
      [ENTITY_REGISTRY.event.tableName]: EVENT,
      [DATABASE_TABLES.EVENT_ATTENDEES]: { id: 'a1', user_id: 'g', payment_status: 'paid' },
    });
    const admin = fakeClient({});
    await refundTicket(
      { supabase: user.client, admin: admin.client, organizerId: 'org' },
      { eventId: 'e1', attendeeId: 'a1', method: 'other' }
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Ticket refunded',
        message: expect.stringMatching(/ticket was cancelled.*gave the money back/),
      })
    );
  });
});
