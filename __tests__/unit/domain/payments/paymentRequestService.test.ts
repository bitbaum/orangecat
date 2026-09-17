/**
 * Payment requests are an ask addressed to a named person, so the guards that
 * matter are about authorship and honesty:
 *  - a request is written through the CALLER's client, so RLS ("you may only
 *    ask on your own behalf") is what enforces authorship — inserting through
 *    the admin client here would silently make impersonation possible;
 *  - the requester must actually be askable-of before we bother someone;
 *  - no invoice is minted at request time, because a BOLT11 dies in an hour and
 *    a request has to outlive it.
 */

import {
  createPaymentRequest,
  closePaymentRequest,
  listPaymentRequests,
} from '@/domain/payments/paymentRequestService';
import { getAdminClient } from '@/lib/supabase/admin';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { PAY_MAX_BTC } from '@/config/pay';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

const adminMock = getAdminClient as Mock;
const dispatchMock = NotificationDispatcher.dispatch as Mock;

const REQUESTER = 'requester-1';
const PAYER = 'payer-1';

/** Admin client that resolves usernames to profiles. */
function mockAdmin(profile: { id: string; username?: string } | null) {
  adminMock.mockReturnValue({
    from: () => {
      const b: Record<string, unknown> = {};
      b.select = () => b;
      b.ilike = () => b;
      b.eq = () => b;
      b.maybeSingle = () => Promise.resolve({ data: profile });
      return b;
    },
  });
}

/** Caller-scoped client; records what was inserted and through which client. */
function makeCallerClient(inserted: Record<string, unknown>[]) {
  return {
    from: () => {
      const b: Record<string, unknown> = {};
      b.insert = (payload: Record<string, unknown>) => {
        inserted.push(payload);
        return b;
      };
      b.select = () => b;
      b.single = () =>
        Promise.resolve({
          data: { id: 'req-1', status: 'pending', amount_btc: 0.0005, ...inserted[0] },
          error: null,
        });
      return b;
    },
  } as unknown as SupabaseClient;
}

beforeEach(() => vi.clearAllMocks());

describe('createPaymentRequest', () => {
  it('writes through the caller client so RLS enforces authorship', async () => {
    mockAdmin({ id: PAYER, username: 'marco' });
    const inserted: Record<string, unknown>[] = [];
    const result = await createPaymentRequest(makeCallerClient(inserted), REQUESTER, {
      payerUsername: 'marco',
      amountBtc: 0.0005,
      note: 'Dinner',
    });

    expect(result.ok).toBe(true);
    expect(inserted[0]).toMatchObject({
      requester_id: REQUESTER,
      payer_id: PAYER,
      amount_btc: 0.0005,
      note: 'Dinner',
    });
  });

  it('never mints an invoice at request time — the ask must outlive a BOLT11', async () => {
    mockAdmin({ id: PAYER, username: 'marco' });
    const inserted: Record<string, unknown>[] = [];
    await createPaymentRequest(makeCallerClient(inserted), REQUESTER, {
      payerUsername: 'marco',
      amountBtc: 0.0005,
    });
    expect(Object.keys(inserted[0])).not.toContain('bolt11');
    expect(Object.keys(inserted[0])).not.toContain('paid_intent_id');
  });

  it('notifies the payer with a one-tap pay link', async () => {
    mockAdmin({ id: PAYER, username: 'marco' });
    await createPaymentRequest(makeCallerClient([]), REQUESTER, {
      payerUsername: 'marco',
      amountBtc: 0.0005,
    });
    expect(dispatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: PAYER,
        type: 'payment',
        data: expect.objectContaining({ kind: 'payment_request' }),
      })
    );
  });

  it('tolerates an @ prefix on the username', async () => {
    mockAdmin({ id: PAYER, username: 'marco' });
    const inserted: Record<string, unknown>[] = [];
    const result = await createPaymentRequest(makeCallerClient(inserted), REQUESTER, {
      payerUsername: '@marco',
      amountBtc: 0.0005,
    });
    expect(result.ok).toBe(true);
    expect(inserted[0]).toMatchObject({ payer_id: PAYER });
  });

  it('refuses an unknown payer without notifying anyone', async () => {
    mockAdmin(null);
    const result = await createPaymentRequest(makeCallerClient([]), REQUESTER, {
      payerUsername: 'ghost',
      amountBtc: 0.0005,
    });
    expect(result).toMatchObject({ ok: false, reason: 'payer_not_found' });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('refuses a request addressed to yourself', async () => {
    mockAdmin({ id: REQUESTER, username: 'lena' });
    const result = await createPaymentRequest(makeCallerClient([]), REQUESTER, {
      payerUsername: 'lena',
      amountBtc: 0.0005,
    });
    expect(result).toMatchObject({ ok: false, reason: 'self_request' });
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['over the cap', PAY_MAX_BTC + 1],
  ])('refuses a %s amount before touching the database', async (_label, amountBtc) => {
    mockAdmin({ id: PAYER, username: 'marco' });
    const inserted: Record<string, unknown>[] = [];
    const result = await createPaymentRequest(makeCallerClient(inserted), REQUESTER, {
      payerUsername: 'marco',
      amountBtc,
    });
    expect(result).toMatchObject({ ok: false, reason: 'invalid_amount' });
    expect(inserted).toHaveLength(0);
  });
});

describe('closePaymentRequest', () => {
  function makeUpdateClient(result: { id: string } | null) {
    const applied: Array<[string, unknown]> = [];
    const client = {
      from: () => {
        const b: Record<string, unknown> = {};
        b.update = (payload: Record<string, unknown>) => {
          applied.push(['update', payload]);
          return b;
        };
        b.eq = (col: string, val: unknown) => {
          applied.push([col, val]);
          return b;
        };
        b.select = () => b;
        b.maybeSingle = () => Promise.resolve({ data: result, error: null });
        return b;
      },
    } as unknown as SupabaseClient;
    return { client, applied };
  }

  it('only closes a request that is still pending', async () => {
    const { client, applied } = makeUpdateClient({ id: 'req-1' });
    const result = await closePaymentRequest(client, 'req-1', 'declined');
    expect(result.ok).toBe(true);
    expect(applied).toContainEqual(['status', 'pending']);
  });

  it('reports an already-closed request without distinguishing why', async () => {
    const { client } = makeUpdateClient(null);
    const result = await closePaymentRequest(client, 'req-1', 'cancelled');
    expect(result).toMatchObject({ ok: false, reason: 'not_pending' });
  });

  it('never writes a paid status — settlement is not a party claim', async () => {
    const { client, applied } = makeUpdateClient({ id: 'req-1' });
    await closePaymentRequest(client, 'req-1', 'declined');
    const update = applied.find(([k]) => k === 'update')?.[1] as Record<string, unknown>;
    expect(update.status).toBe('declined');
    expect(update).not.toHaveProperty('paid_intent_id');
  });
});

describe('listPaymentRequests', () => {
  const LENA = { username: 'lena', name: 'Lena Brunner' };
  const MARCO = { username: 'marco', name: 'Marco Testi' };

  function listClient(rows: unknown[]) {
    return {
      from: () => {
        const b: Record<string, unknown> = {};
        b.select = () => b;
        b.order = () => b;
        b.limit = () => Promise.resolve({ data: rows });
        return b;
      },
    } as unknown as SupabaseClient;
  }

  it('splits rows by which side of the ask the caller is on', async () => {
    const rows = [
      { id: 'a', requester_id: REQUESTER, payer_id: PAYER },
      { id: 'b', requester_id: PAYER, payer_id: REQUESTER },
    ];

    const { incoming, outgoing } = await listPaymentRequests(listClient(rows), REQUESTER);
    expect(outgoing.map(r => r.id)).toEqual(['a']);
    expect(incoming.map(r => r.id)).toEqual(['b']);
  });

  it('names the OTHER person on each row, never the caller', async () => {
    const rows = [
      // The caller asked Marco.
      { id: 'a', requester_id: REQUESTER, payer_id: PAYER, requester: LENA, payer: MARCO },
      // Marco asked the caller.
      { id: 'b', requester_id: PAYER, payer_id: REQUESTER, requester: MARCO, payer: LENA },
    ];

    const { incoming, outgoing } = await listPaymentRequests(listClient(rows), REQUESTER);
    expect(outgoing[0].counterparty_name).toBe('Marco Testi');
    expect(outgoing[0].counterparty_username).toBe('marco');
    expect(incoming[0].counterparty_name).toBe('Marco Testi');
  });

  it('reads an embed that arrives as a one-element array', async () => {
    const rows = [
      { id: 'a', requester_id: REQUESTER, payer_id: PAYER, requester: [LENA], payer: [MARCO] },
    ];

    const { outgoing } = await listPaymentRequests(listClient(rows), REQUESTER);
    expect(outgoing[0].counterparty_username).toBe('marco');
  });

  it('falls back to the username when someone has no display name', async () => {
    const rows = [
      {
        id: 'a',
        requester_id: REQUESTER,
        payer_id: PAYER,
        requester: LENA,
        payer: { username: 'marco', name: null },
      },
    ];

    const { outgoing } = await listPaymentRequests(listClient(rows), REQUESTER);
    expect(outgoing[0].counterparty_name).toBe('marco');
  });

  it('never leaks the raw profile embeds to the client', async () => {
    const rows = [
      { id: 'a', requester_id: REQUESTER, payer_id: PAYER, requester: LENA, payer: MARCO },
    ];

    const { outgoing } = await listPaymentRequests(listClient(rows), REQUESTER);
    expect(outgoing[0]).not.toHaveProperty('requester');
    expect(outgoing[0]).not.toHaveProperty('payer');
  });
});
