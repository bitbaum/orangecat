/**
 * The line a payer's wallet keeps for a payment made on OrangeCat.
 *
 * /pay/<name>, the article Tip dialog, the owner's Receive screen and the
 * settling of a request all mint through one path, and it labelled every one
 * of them "Tip for <name>" — in the Lightning invoice description and in the
 * on-chain BIP21 label. Someone settling a request for rent saw a tip in their
 * wallet history. The line names the payee, and the request's note when the
 * payment answers one.
 */

import { initiateTip as initiateTipIntent } from '@/domain/payments/paymentInitiation';
import { initiateTip } from '@/domain/tips/tip-service';
import { initiateTip as initiateTipPayment } from '@/domain/payments/paymentFlowService';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import { findOpenRequestFor } from '@/domain/payments/paymentRequestService';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import { getAdminClient } from '@/lib/supabase/admin';
import type { ResolvedWallet } from '@/domain/payments/types';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({ generateInvoice: vi.fn() }));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  resolveUserWallet: vi.fn(),
  resolveSellerWallet: vi.fn(),
  getSellerUserId: vi.fn(),
}));
vi.mock('@/domain/payments/paymentRequestService', () => ({ findOpenRequestFor: vi.fn() }));
// tip-service hands off to this; the real mint is imported from paymentInitiation above.
vi.mock('@/domain/payments/paymentFlowService', () => ({
  initiateTip: vi.fn(),
  checkPublicPaymentStatus: vi.fn(),
}));
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: vi.fn().mockResolvedValue(undefined) },
}));

const WALLET: ResolvedWallet = {
  method: 'onchain',
  wallet_id: 'w-1',
  onchain_address: 'bc1qexample',
} as ResolvedWallet;

/** The server's client: records the intent it is asked to insert. */
function adminRecorder() {
  const inserts: Array<Record<string, unknown>> = [];
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn((row: Record<string, unknown>) => {
    inserts.push(row);
    return builder;
  });
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn(() =>
    Promise.resolve({ data: { id: 'pi-1', ...inserts[inserts.length - 1] }, error: null })
  );
  return { client: { from: vi.fn(() => builder) }, inserts };
}

beforeEach(() => {
  vi.clearAllMocks();
  (generateInvoice as Mock).mockResolvedValue({
    method: 'onchain',
    bolt11: null,
    payment_hash: null,
    onchain_address: 'bc1qexample',
    lnurl_verify_url: null,
    qr_data: 'bitcoin:bc1qexample',
    expires_at: null,
  });
});

describe('the invoice description', () => {
  it('names the payee, not a tip', async () => {
    const { client, inserts } = adminRecorder();
    (getAdminClient as Mock).mockReturnValue(client);

    await initiateTipIntent({
      recipientUserId: 'u-1',
      recipientName: 'Penguin',
      wallet: WALLET,
      amountBtc: 0.0002,
    });

    expect(generateInvoice).toHaveBeenCalledWith(WALLET, 0.0002, 'Payment to Penguin');
    expect(inserts[0].description).toBe('Payment to Penguin');
  });

  it('carries what the request was for when the payment answers one', async () => {
    const { client, inserts } = adminRecorder();
    (getAdminClient as Mock).mockReturnValue(client);

    await initiateTipIntent({
      recipientUserId: 'u-1',
      recipientName: 'Cato',
      wallet: WALLET,
      amountBtc: 0.0002,
      paymentRequestId: 'r-1',
      requestNote: ' Dinner on Friday ',
    });

    expect(generateInvoice).toHaveBeenCalledWith(
      WALLET,
      0.0002,
      'Payment to Cato: Dinner on Friday'
    );
    expect(inserts[0]).toMatchObject({
      description: 'Payment to Cato: Dinner on Friday',
      payment_request_id: 'r-1',
    });
  });
});

describe('a pay link that answers a request', () => {
  it("hands the open request's note to the mint", async () => {
    (resolveUserWallet as Mock).mockResolvedValue(WALLET);
    (findOpenRequestFor as Mock).mockResolvedValue({
      id: 'r-1',
      amount_btc: 0.0002,
      note: 'Dinner on Friday',
    });
    (initiateTipPayment as Mock).mockResolvedValue({
      payment_intent: { id: 'pi-1' },
      status_token: 't',
      qr_data: 'bitcoin:bc1qexample',
      method_label: 'On-chain',
      expires_in_seconds: null,
    });
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: 'u-1', username: 'cato', display_name: 'Cato' },
              error: null,
            }),
          }),
        }),
      }),
    } as never;

    await initiateTip(supabase, 'cato', 0.0002, 'r-1');

    expect(initiateTipPayment).toHaveBeenCalledWith(
      expect.objectContaining({ paymentRequestId: 'r-1', requestNote: 'Dinner on Friday' })
    );
  });
});

describe('a Lightning address provider', () => {
  it('gets a comment no longer than it says it takes', async () => {
    const { generateInvoice: realGenerate } = await vi.importActual<
      typeof import('@/domain/payments/invoiceGenerationService')
    >('@/domain/payments/invoiceGenerationService');
    const callbacks: URL[] = [];
    const fetchMock = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes('/.well-known/lnurlp/')) {
        return {
          ok: true,
          json: async () => ({
            tag: 'payRequest',
            callback: 'https://ln.example/cb',
            minSendable: 1000,
            maxSendable: 100_000_000_000,
            metadata: '[["text/plain","pay"]]',
            commentAllowed: 20,
          }),
        };
      }
      callbacks.push(new URL(href));
      return { ok: true, json: async () => ({ pr: 'lnbc1example' }) };
    });
    vi.stubGlobal('fetch', fetchMock);

    await realGenerate(
      { method: 'lightning_address', wallet_id: 'w-2', lightning_address: 'cato@ln.example' },
      0.0002,
      'Payment to Cato: Dinner on Friday'
    );

    expect(callbacks[0].searchParams.get('comment')).toBe('Payment to Cato: Din');
    expect(callbacks[0].searchParams.get('comment')).toHaveLength(20);
    vi.unstubAllGlobals();
  });
});
