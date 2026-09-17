/**
 * tip-service — recipient resolution + tip orchestration. Mocks the reused
 * payment primitives so we test the tip layer in isolation: unknown person,
 * person without a wallet, the happy-path intent shape, and status mapping.
 */

import { initiateTip, getTipReceiveInfo, getTipStatus } from '@/domain/tips/tip-service';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import {
  initiateTip as initiateTipPayment,
  checkPublicPaymentStatus,
} from '@/domain/payments/paymentFlowService';

vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveUserWallet: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: vi.fn(() => ({})),
}));
vi.mock('@/domain/payments/paymentFlowService', () => ({
  initiateTip: vi.fn(),
  checkPublicPaymentStatus: vi.fn(),
}));
// The dispatcher transitively imports the Resend email client, which cannot
// load in the jest environment — and we want to assert dispatch calls anyway.
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));
// Dead-end dedup reads recent notifications through fromTable; default: none.
const mockDedupLimit = vi.fn().mockResolvedValue({ data: [] });
vi.mock('@/lib/supabase/untyped', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    limit: mockDedupLimit,
  })),
}));

import { NotificationDispatcher } from '@/services/notifications/dispatcher';

import type { MockedFunction } from 'vitest';

/** The dead-end notification is fire-and-forget — let its microtasks settle. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

const mockResolveWallet = resolveUserWallet as MockedFunction<typeof resolveUserWallet>;
const mockInitiateTipPayment = initiateTipPayment as MockedFunction<typeof initiateTipPayment>;
const mockCheckStatus = checkPublicPaymentStatus as MockedFunction<typeof checkPublicPaymentStatus>;

/** Minimal supabase stub whose profiles lookup resolves to `profile`. */
function supabaseWith(profile: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
      }),
    }),
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getTipReceiveInfo', () => {
  it('returns null for an unknown username', async () => {
    expect(await getTipReceiveInfo(supabaseWith(null), 'ghost')).toBeNull();
    expect(mockResolveWallet).not.toHaveBeenCalled();
  });

  it('reports canReceive=false when the person has no wallet', async () => {
    mockResolveWallet.mockResolvedValue(null);
    const info = await getTipReceiveInfo(
      supabaseWith({ id: 'u1', username: 'alice', display_name: 'Alice' }),
      'alice'
    );
    expect(info).toEqual({ canReceive: false, recipientName: 'Alice', methodLabel: undefined });
  });

  it('notifies the would-be recipient of a tip dead end (fire-and-forget)', async () => {
    mockResolveWallet.mockResolvedValue(null);
    await getTipReceiveInfo(
      supabaseWith({ id: 'u1', username: 'alice', display_name: 'Alice' }),
      'alice'
    );
    await flush();
    expect(NotificationDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', type: 'tip_dead_end' })
    );
  });

  it('dedupes the dead-end notification when a recent one exists', async () => {
    mockResolveWallet.mockResolvedValue(null);
    mockDedupLimit.mockResolvedValueOnce({ data: [{ id: 'n1' }] });
    await getTipReceiveInfo(
      supabaseWith({ id: 'u1', username: 'alice', display_name: 'Alice' }),
      'alice'
    );
    await flush();
    expect(NotificationDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('does not notify when the person CAN receive', async () => {
    mockResolveWallet.mockResolvedValue({
      method: 'lightning_address',
      wallet_id: 'w1',
      lightning_address: 'a@b.c',
    });
    await getTipReceiveInfo(
      supabaseWith({ id: 'u1', username: 'alice', display_name: 'Alice' }),
      'alice'
    );
    await flush();
    expect(NotificationDispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('reports the rail label when a wallet exists', async () => {
    mockResolveWallet.mockResolvedValue({
      method: 'onchain',
      wallet_id: 'w1',
      onchain_address: 'bc1x',
    });
    const info = await getTipReceiveInfo(
      supabaseWith({ id: 'u1', username: 'bob', display_name: 'Bob' }),
      'bob'
    );
    expect(info).toEqual({
      canReceive: true,
      recipientName: 'Bob',
      methodLabel: 'On-chain Bitcoin',
    });
  });
});

describe('initiateTip', () => {
  it('errors when the person cannot be found', async () => {
    const r = await initiateTip(supabaseWith(null), 'ghost', 0.0001);
    expect(r).toEqual({ ok: false, error: 'That person could not be found.' });
    expect(mockInitiateTipPayment).not.toHaveBeenCalled();
  });

  it('errors (no throw) when the recipient has no wallet', async () => {
    mockResolveWallet.mockResolvedValue(null);
    const r = await initiateTip(
      supabaseWith({ id: 'u1', username: 'alice', display_name: 'Alice' }),
      'alice',
      0.0001
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/hasn't set up a wallet/);
    expect(mockInitiateTipPayment).not.toHaveBeenCalled();
  });

  it('mints a tip intent against the recipient wallet and returns the pollable shape', async () => {
    mockResolveWallet.mockResolvedValue({
      method: 'lightning_address',
      wallet_id: 'w1',
      lightning_address: 'bob@ln.tld',
    });
    mockInitiateTipPayment.mockResolvedValue({
      payment_intent: {
        id: 'pi_1',
        amount_btc: 0.0005,
        payment_method: 'lightning_address',
        status: 'invoice_ready',
        expires_at: null,
        can_acknowledge: false,
      },
      status_token: 'tok_abc',
      qr_data: 'LNBC1...',
      method_label: 'Lightning Address',
      expires_in_seconds: 3600,
    });

    const r = await initiateTip(
      supabaseWith({ id: 'u1', username: 'bob', display_name: 'Bob' }),
      'bob',
      0.0005
    );

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.invoice).toMatchObject({
        intentId: 'pi_1',
        statusToken: 'tok_abc',
        qrData: 'LNBC1...',
        recipientName: 'Bob',
        amountBtc: 0.0005,
      });
    }
    // The intent is minted against the recipient's own wallet — never a platform wallet.
    expect(mockInitiateTipPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'u1',
        recipientName: 'Bob',
        amountBtc: 0.0005,
        wallet: expect.objectContaining({ lightning_address: 'bob@ln.tld' }),
      })
    );
  });
});

describe('getTipStatus', () => {
  it('maps a settled intent to paid', async () => {
    mockCheckStatus.mockResolvedValue({
      status: 'paid',
      paid_at: '2026-07-28T00:00:00Z',
      requires_recipient_confirmation: false,
    });
    expect(await getTipStatus('pi_1', 'tok')).toEqual({
      status: 'paid',
      paidAt: '2026-07-28T00:00:00Z',
    });
  });

  it('collapses non-terminal statuses to pending', async () => {
    mockCheckStatus.mockResolvedValue({
      status: 'invoice_ready',
      paid_at: null,
      requires_recipient_confirmation: false,
    });
    expect(await getTipStatus('pi_1', 'tok')).toEqual({ status: 'pending', paidAt: null });
  });
});
