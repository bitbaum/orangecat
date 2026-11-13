/**
 * From adversarial review of the investment-minimum fix: the page converts a
 * fiat minimum to BTC when it renders and opens the card at exactly that
 * figure; the server converts it again at payment time, at whatever the rate is
 * then. A CHF 100 minimum is 0.00116279 BTC at 86,000 and 0.00116414 BTC at
 * 85,900: a 0.1% move refused a payer who paid exactly the CHF 100 the page
 * offered. And a minimum above one payment's cap (1 BTC) produced a card that
 * opened at 1 BTC and refused it.
 */

import { initiatePublicSupport } from '@/domain/payments/paymentInitiation';
import { mapKnownPaymentError } from '@/domain/payments/knownPaymentErrors';
import { getSellerUserId } from '@/domain/payments/walletResolutionService';
import { getAdminClient } from '@/lib/supabase/admin';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import {
  FIAT_BOUND_DRIFT,
  breachedBound,
  contributionRange,
  isFiatBoundCurrency,
} from '@/config/contribution-terms';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/domain/payments/walletResolutionService', () => ({
  getSellerUserId: vi.fn(),
  resolveSellerWallet: vi.fn(),
}));
vi.mock('@/domain/payments/invoiceGenerationService', () => ({ generateInvoice: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));
vi.mock('@/services/currency/rates.server', () => ({ convertToBtcOrNull: vi.fn() }));

const convertMock = convertToBtcOrNull as Mock;
const adminMock = getAdminClient as Mock;
const sellerMock = getSellerUserId as Mock;

function clientServing(row: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: row, error: null }));
  builder.single = vi.fn(() => Promise.resolve({ data: row, error: null }));
  return { from: vi.fn(() => builder) };
}

const atRate = (chfPerBtc: number) => async (amount: number, currency: string) =>
  currency === 'BTC' ? amount : currency === 'CHF' ? amount / chfPerBtc : null;

// The figure the page opened the card at: CHF 100 at 86,000.
const OFFERED_BTC = Number((100 / 86_000).toFixed(8));

beforeEach(() => {
  vi.clearAllMocks();
  sellerMock.mockResolvedValue(null); // past the terms, the next gate stops the test
});

describe('a fiat minimum allows for the rate moving between page and payment', () => {
  it('takes exactly the CHF minimum the page offered after a 0.1% move', async () => {
    const row = { id: 'inv-1', minimum_investment: 100, currency: 'CHF' };
    adminMock.mockReturnValue(clientServing(row));
    convertMock.mockImplementation(atRate(85_900));
    const supabase = clientServing(row) as never;

    await expect(
      initiatePublicSupport(supabase, {
        entity_type: 'investment',
        entity_id: 'inv-1',
        amount_btc: OFFERED_BTC,
      })
    ).rejects.not.toThrow(/minimum investment/);
    expect(sellerMock).toHaveBeenCalled(); // got past the terms
  });

  it('still refuses an amount clearly below the minimum', async () => {
    const row = { id: 'inv-1', minimum_investment: 100, currency: 'CHF' };
    adminMock.mockReturnValue(clientServing(row));
    convertMock.mockImplementation(atRate(85_900));
    const supabase = clientServing(row) as never;

    await expect(
      initiatePublicSupport(supabase, {
        entity_type: 'investment',
        entity_id: 'inv-1',
        amount_btc: OFFERED_BTC * 0.9,
      })
    ).rejects.toThrow('The minimum investment is CHF 100.00.');
  });

  it('keeps a BTC minimum exact: no drift where no rate is involved', () => {
    expect(isFiatBoundCurrency('BTC')).toBe(false);
    expect(isFiatBoundCurrency('chf')).toBe(true);
    expect(breachedBound(0.00099, { minBtc: 0.001, maxBtc: null })).toBe('min');
    expect(breachedBound(0.00099, { minBtc: 0.001, maxBtc: null }, FIAT_BOUND_DRIFT)).toBeNull();
  });
});

describe('a minimum above what one payment can be', () => {
  it('is reported as unpayable instead of opening a field that refuses it', () => {
    expect(contributionRange({ minBtc: 1.5, maxBtc: null }).unpayable).toBe(true);
    expect(contributionRange({ minBtc: 0.001, maxBtc: null }).unpayable).toBe(false);
    expect(contributionRange(null).unpayable).toBe(false);
  });
});

describe('a rate outage on the signed-in path', () => {
  it('reads as a plain message, not a server error', () => {
    expect(
      mapKnownPaymentError('Bitcoin exchange rate unavailable for CHF; refusing to check the terms')
    ).toMatch(/could not check the Bitcoin exchange rate/);
  });
});
