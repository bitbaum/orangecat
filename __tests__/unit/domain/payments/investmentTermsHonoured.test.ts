/**
 * An investment's stated minimum and maximum hold on the server.
 *
 * Production, 2026-11-12: /investments/3eea8a36-… printed "Minimum Investment
 * ₿0.001", and its "Review & invest" CTA led to a card that opened at
 * 0.0001 BTC (CHF 6.10) with CHF 5–50 suggestions — and the server would mint
 * an invoice for any of them. Both initiation paths (signed out and signed in)
 * now refuse an amount outside the stated terms before anything is minted, in
 * one message that names the bound as the page states it.
 */

import { initiatePayment, initiatePublicSupport } from '@/domain/payments/paymentInitiation';
import {
  ContributionOutsideTermsError,
  mapKnownPaymentError,
} from '@/domain/payments/knownPaymentErrors';
import { getSellerUserId, resolveSellerWallet } from '@/domain/payments/walletResolutionService';
import { generateInvoice } from '@/domain/payments/invoiceGenerationService';
import { getAdminClient } from '@/lib/supabase/admin';
import { convertToBtcOrNull } from '@/services/currency/rates.server';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  getSellerUserId: vi.fn(),
  resolveSellerWallet: vi.fn(),
}));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({
  generateInvoice: vi.fn(),
}));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/currency/rates.server', () => ({ convertToBtcOrNull: vi.fn() }));

const sellerMock = getSellerUserId as Mock;
const walletMock = resolveSellerWallet as Mock;
const invoiceMock = generateInvoice as Mock;
const adminMock = getAdminClient as Mock;
const convertMock = convertToBtcOrNull as Mock;

/** A client whose reads all answer with `row` (the visibility gate, the terms read). */
function clientServing(row: Record<string, unknown> | null) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: row, error: null }));
  builder.single = vi.fn(() => Promise.resolve({ data: row, error: null }));
  return { from: vi.fn(() => builder) };
}

const INVESTMENT = { entity_type: 'investment' as const, entity_id: 'inv-1' };

function investment(terms: Record<string, unknown>) {
  const row = { id: 'inv-1', ...terms };
  adminMock.mockReturnValue(clientServing(row));
  return clientServing(row) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  // BTC needs no rate; CHF at 60,000 per BTC.
  convertMock.mockImplementation(async (amount: number, currency: string) =>
    currency === 'BTC' ? amount : currency === 'CHF' ? amount / 60_000 : null
  );
  sellerMock.mockResolvedValue(null); // past the terms, the next gate stops the test
});

describe('public support — an investment is taken only on its stated terms', () => {
  it('refuses less than the minimum, before the seller or wallet is resolved', async () => {
    const supabase = investment({ minimum_investment: 0.001, currency: 'BTC' });

    const attempt = initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 0.0001 });
    await expect(attempt).rejects.toBeInstanceOf(ContributionOutsideTermsError);
    await expect(
      initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 0.0001 })
    ).rejects.toThrow('The minimum investment is ₿0.001.');
    expect(sellerMock).not.toHaveBeenCalled();
    expect(walletMock).not.toHaveBeenCalled();
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('refuses more than the maximum', async () => {
    const supabase = investment({
      minimum_investment: 0.001,
      maximum_investment: 0.01,
      currency: 'BTC',
    });
    await expect(
      initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 0.02 })
    ).rejects.toThrow('The maximum investment is ₿0.01.');
    expect(invoiceMock).not.toHaveBeenCalled();
  });

  it('lets the minimum itself, and anything inside the terms, through', async () => {
    const supabase = investment({
      minimum_investment: 0.001,
      maximum_investment: 0.01,
      currency: 'BTC',
    });
    for (const amount_btc of [0.001, 0.005, 0.01]) {
      await expect(initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc })).rejects.toThrow(
        'Entity owner not found'
      );
    }
  });

  it("converts terms stated in the investment's own currency", async () => {
    // CHF 120 at 60,000 CHF/BTC = 0.002 BTC.
    const supabase = investment({ minimum_investment: 120, currency: 'CHF' });
    await expect(
      initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 0.0019 })
    ).rejects.toThrow('The minimum investment is CHF 120.00.');
    await expect(
      initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 0.002 })
    ).rejects.toThrow('Entity owner not found');
  });

  it('refuses rather than guess when the terms are in a currency with no rate', async () => {
    const supabase = investment({ minimum_investment: 120, currency: 'CHF' });
    convertMock.mockResolvedValue(null);
    await expect(initiatePublicSupport(supabase, { ...INVESTMENT, amount_btc: 1 })).rejects.toThrow(
      /exchange rate unavailable/i
    );
  });

  it('reads no terms for an entity that states none', async () => {
    const supabase = clientServing({ id: 'cause-1' }) as never;
    await expect(
      initiatePublicSupport(supabase, {
        entity_type: 'cause',
        entity_id: 'cause-1',
        amount_btc: 0.000001,
      })
    ).rejects.toThrow('Entity owner not found');
    expect(adminMock).not.toHaveBeenCalled();
  });
});

describe('signed-in payment — the same terms hold', () => {
  it('refuses less than the minimum before an invoice is minted', async () => {
    const supabase = investment({ minimum_investment: 0.001, currency: 'BTC' });
    sellerMock.mockResolvedValue('seller-1');
    walletMock.mockResolvedValue({ wallet_id: 'w-1' });

    await expect(
      initiatePayment(supabase, 'buyer-1', { ...INVESTMENT, amount_btc: 0.0001 })
    ).rejects.toThrow('The minimum investment is ₿0.001.');
    expect(invoiceMock).not.toHaveBeenCalled();
  });
});

describe('the refusal reaches the payer as written', () => {
  it('is passed through by the shared error mapper', () => {
    const refusal = new ContributionOutsideTermsError('The minimum investment is ₿0.001.');
    expect(mapKnownPaymentError(refusal.message, refusal)).toBe(
      'The minimum investment is ₿0.001.'
    );
    // Other errors keep their canned messages.
    expect(mapKnownPaymentError('Seller has no wallet connected', new Error('x'))).toBe(
      'Seller has no payment method configured'
    );
  });
});
