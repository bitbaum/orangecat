/**
 * The token-authenticated settlement path — a payer with no account.
 *
 * Someone paying a shared pay link has no session, so their browser polls with
 * a one-off token and reports "I've paid" through the same token. That whole
 * surface was untested: every mutant survived, including ones that would let
 * any token read any payment, or accept a payer's claim on a rail we can verify
 * ourselves.
 *
 * The properties that matter here:
 *  - the token is the authorisation; a wrong one must reveal nothing;
 *  - a claim is TESTIMONY, only accepted where no rail can answer for us;
 *  - expiry bounds when a payment can be MADE, not when it can be REPORTED —
 *    the claim window stays open past the invoice deadline;
 *  - the recipient is told exactly once, on the real transition.
 */

import {
  checkPublicPaymentStatus,
  acknowledgePublicPayment,
} from '@/domain/payments/paymentFlowService';
import { hashPublicStatusToken } from '@/domain/payments/paymentFlowHelpers';
import { BUYER_CLAIM_GRACE_MS } from '@/domain/payments/intentExpiry';
import { STATUS } from '@/config/database-constants';
import { DATABASE_TABLES } from '@/config/database-tables';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { createFakeSupabase, type Row } from '../../../../test-utils/fakeSupabase';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/email/send-seller-notification', () => ({
  sendSellerPaymentNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/domain/payments/paymentStatusService', () => ({
  checkNWCPaymentStatus: vi.fn().mockResolvedValue(false),
  checkOnchainPaymentStatus: vi.fn().mockResolvedValue('none'),
  checkLnurlVerifyPaymentStatus: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));

import { getAdminClient } from '@/lib/supabase/admin';
import type { Mock } from 'vitest';

const getAdminClientMock = getAdminClient as Mock;
const dispatchMock = NotificationDispatcher.dispatch as Mock;

const PI_ID = 'pi-1';
const TOKEN = 'token-abc';
const SELLER = 'seller-1';

/** Far enough ahead that neither expiry nor the claim window is in play. */
const ALIVE = new Date(Date.now() + 60 * 60 * 1000).toISOString();
/** Invoice deadline passed, but the claim window is still open. */
const JUST_EXPIRED = new Date(Date.now() - 60 * 1000).toISOString();
/** Both the invoice and the claim window are closed. */
const LONG_DEAD = new Date(Date.now() - BUYER_CLAIM_GRACE_MS - 60 * 1000).toISOString();

function intent(over: Row = {}): Row {
  return {
    id: PI_ID,
    buyer_id: null,
    seller_id: SELLER,
    entity_type: 'product',
    entity_id: 'prod-1',
    amount_btc: 0.0005,
    payment_method: 'lightning_address',
    lnurl_verify_url: null,
    payment_hash: null,
    onchain_address: null,
    intent_kind: 'purchase',
    status: STATUS.PAYMENT_INTENTS.INVOICE_READY,
    description: 'Payment for: Roasted beans',
    expires_at: ALIVE,
    paid_at: null,
    public_status_token_hash: hashPublicStatusToken(TOKEN),
    ...over,
  };
}

function world(row: Row) {
  const fake = createFakeSupabase({ [DATABASE_TABLES.PAYMENT_INTENTS]: [row] });
  getAdminClientMock.mockReturnValue(fake.client);
  return fake;
}

beforeEach(() => vi.clearAllMocks());

describe('the token is the authorisation', () => {
  it('reveals nothing to a wrong token', async () => {
    world(intent());

    await expect(checkPublicPaymentStatus(PI_ID, 'not-the-token')).rejects.toThrow(
      'Payment not found'
    );
  });

  it('will not accept a claim under a wrong token', async () => {
    const fake = world(intent());

    await expect(acknowledgePublicPayment(PI_ID, 'not-the-token')).rejects.toThrow(
      'Payment not found'
    );
    expect(fake.updates).toEqual([]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('reads status with the right token', async () => {
    world(intent({ status: STATUS.PAYMENT_INTENTS.PAID, paid_at: '2026-08-01T10:00:00Z' }));

    expect(await checkPublicPaymentStatus(PI_ID, TOKEN)).toEqual({
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: '2026-08-01T10:00:00Z',
      requires_recipient_confirmation: false,
    });
  });

  it('tells the payer when their claim is waiting on the recipient', async () => {
    world(intent({ status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED }));

    expect(await checkPublicPaymentStatus(PI_ID, TOKEN)).toEqual({
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
      requires_recipient_confirmation: true,
    });
  });
});

describe('a claim is only accepted where no rail can answer', () => {
  it('records the claim for a bare Lightning address', async () => {
    const fake = world(intent());

    const result = await acknowledgePublicPayment(PI_ID, TOKEN);

    expect(result).toEqual({
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
      requires_recipient_confirmation: true,
    });
    expect(fake.updates.map(u => u.patch.status)).toEqual([STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED]);
  });

  it('refuses a claim when the Lightning address can be verified automatically', async () => {
    const fake = world(intent({ lnurl_verify_url: 'https://ln.example/verify/1' }));

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('confirmed automatically');
    expect(fake.updates).toEqual([]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('refuses a claim on an on-chain payment — the mempool answers, not the payer', async () => {
    const fake = world(intent({ payment_method: 'onchain', onchain_address: 'bc1qexample' }));

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('confirmed automatically');
    expect(fake.updates).toEqual([]);
  });

  it('refuses a claim on an NWC payment', async () => {
    const fake = world(intent({ payment_method: 'nwc', payment_hash: 'hash-1' }));

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('confirmed automatically');
    expect(fake.updates).toEqual([]);
  });
});

describe('the recipient hears about a claim exactly once', () => {
  it('notifies the recipient on the real transition, naming the amount', async () => {
    world(intent());

    await acknowledgePublicPayment(PI_ID, TOKEN);

    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const notification = dispatchMock.mock.calls[0][0];
    expect(notification.userId).toBe(SELLER);
    expect(notification.title).toContain('0.0005');
    // The listing the money was for, pulled out of "Payment for: <title>".
    expect(notification.message).toContain('Roasted beans');
    expect(notification.sourceEntityId).toBe('prod-1');
  });

  it('does not notify again when the payer re-submits the same claim', async () => {
    const fake = world(intent({ status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED }));

    const result = await acknowledgePublicPayment(PI_ID, TOKEN);

    // Identical answer to the first claim: still waiting on the recipient.
    expect(result).toEqual({
      status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED,
      paid_at: null,
      requires_recipient_confirmation: true,
    });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(fake.updates).toEqual([]);
  });

  it('is idempotent once the payment is already settled', async () => {
    const fake = world(
      intent({ status: STATUS.PAYMENT_INTENTS.PAID, paid_at: '2026-08-01T10:00:00Z' })
    );

    expect(await acknowledgePublicPayment(PI_ID, TOKEN)).toEqual({
      status: STATUS.PAYMENT_INTENTS.PAID,
      paid_at: '2026-08-01T10:00:00Z',
      requires_recipient_confirmation: false,
    });
    expect(fake.updates).toEqual([]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});

describe('expiry bounds when a payment can be MADE, not when it can be REPORTED', () => {
  it('accepts a claim made just after the invoice died', async () => {
    // The commonest real case: the page was open when the clock ran out.
    const fake = world(intent({ expires_at: JUST_EXPIRED }));

    const result = await acknowledgePublicPayment(PI_ID, TOKEN);

    expect(result.status).toBe(STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED);
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    expect(fake.updates.map(u => u.patch.status)).toEqual([STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED]);
  });

  it('refuses a claim once the claim window has also closed, and records the expiry', async () => {
    const fake = world(intent({ expires_at: LONG_DEAD }));

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('has expired');
    expect(fake.updates.map(u => u.patch.status)).toEqual([STATUS.PAYMENT_INTENTS.EXPIRED]);
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('refuses a claim on an already-expired intent without re-writing its status', async () => {
    const fake = world(
      intent({ status: STATUS.PAYMENT_INTENTS.EXPIRED, expires_at: JUST_EXPIRED })
    );

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('has expired');
    expect(fake.updates).toEqual([]);
  });

  it('refuses a claim on a failed payment', async () => {
    const fake = world(intent({ status: STATUS.PAYMENT_INTENTS.FAILED }));

    await expect(acknowledgePublicPayment(PI_ID, TOKEN)).rejects.toThrow('has expired');
    expect(fake.updates).toEqual([]);
  });
});

/**
 * A claim costs the recipient attention, so it is budgeted per recipient.
 *
 * The route in front of this only knows the caller's IP, and the abuse shape
 * is many addresses aimed at ONE seller's confirmation queue — free intents
 * fanned into plausible "someone paid you" cards, whose payoff is
 * ship-the-goods-for-no-money. bitbaum/orangecat#563 finding 3.
 */
describe('claims are budgeted per recipient', () => {
  const allow = vi.fn(async () => true);
  const refuse = vi.fn(async () => false);

  beforeEach(() => {
    allow.mockClear();
    refuse.mockClear();
  });

  it('asks about the recipient entity, not the caller', async () => {
    world(intent());
    await acknowledgePublicPayment(PI_ID, TOKEN, allow);
    expect(allow).toHaveBeenCalledWith('product', 'prod-1');
  });

  it('refuses the claim once that recipient has been flooded', async () => {
    world(intent());
    await expect(acknowledgePublicPayment(PI_ID, TOKEN, refuse)).rejects.toThrow(
      /Too many payment claims/
    );
  });

  it('sends no card and moves no intent when the claim is refused', async () => {
    const fake = world(intent());

    await expect(acknowledgePublicPayment(PI_ID, TOKEN, refuse)).rejects.toThrow();

    // The whole point: nothing reaches the seller, and the intent stays put.
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(fake.updates).toEqual([]);
  });

  it('does not spend the budget on an idempotent re-claim', async () => {
    // Already buyer_confirmed: this returns early, costs the attacker nothing,
    // and so must not consume a genuine payer's allowance either.
    world(intent({ status: STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED }));

    await acknowledgePublicPayment(PI_ID, TOKEN, allow);
    expect(allow).not.toHaveBeenCalled();
  });

  it('is unbudgeted when no guard is supplied — the caller owns the policy', async () => {
    const fake = world(intent());
    await acknowledgePublicPayment(PI_ID, TOKEN);
    expect(fake.updates.map(u => u.patch.status)).toEqual([STATUS.PAYMENT_INTENTS.BUYER_CONFIRMED]);
  });
});
