// @vitest-environment jsdom
/**
 * useDisplayCurrency — the SSOT money-display path used across the UI.
 *
 * Locks in the branching that decides how an amount is rendered: zero handling
 * per unit, fiat conversion, sats/BTC modes, forceSats, showBoth, and the
 * rates-still-loading fallback to sats (so the UI never flashes a wrong fiat
 * number before rates arrive).
 */

import { renderHook } from '@testing-library/react';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

// Mutable so each test can pick a display currency / loading state.
let mockCurrency = 'CHF';
let mockIsLoading = false;
const CHF_PER_BTC = 86000;

vi.mock('@/hooks/useUserCurrency', () => ({
  useUserCurrency: () => mockCurrency,
}));
vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({
    isLoading: mockIsLoading,
    convertFromBTC: (btc: number, currency: string) => (currency === 'CHF' ? btc * CHF_PER_BTC : 0),
    convertToBTC: (amount: number) => amount / CHF_PER_BTC,
  }),
}));

beforeEach(() => {
  mockCurrency = 'CHF';
  mockIsLoading = false;
});

describe('useDisplayCurrency', () => {
  it('formats BTC into the user fiat currency', () => {
    const { result } = renderHook(() => useDisplayCurrency());
    // 0.001 BTC * 86,000 = CHF 86
    expect(result.current.formatAmountBtc(0.001)).toBe('CHF 86.00');
    expect(result.current.prefersFiat).toBe(true);
  });

  it('renders zero per unit', () => {
    mockCurrency = 'CHF';
    const chf = renderHook(() => useDisplayCurrency());
    expect(chf.result.current.formatSats(0)).toBe('CHF 0.00');

    mockCurrency = 'BTC';
    const btc = renderHook(() => useDisplayCurrency());
    expect(btc.result.current.formatSats(0)).toBe('₿0');
  });

  it('renders BTC preference with the ₿ symbol', () => {
    mockCurrency = 'BTC';
    const { result } = renderHook(() => useDisplayCurrency());
    expect(result.current.formatAmountBtc(0.001)).toBe('₿0.001');
  });

  it('falls back to BTC (never sats) while rates are loading', () => {
    // The platform never displays sats. Before fiat rates load (e.g. logged-out
    // visitors) we show the canonical BTC unit, not raw sats.
    mockCurrency = 'CHF';
    mockIsLoading = true;
    const { result } = renderHook(() => useDisplayCurrency());
    const out = result.current.formatSats(100_000); // 0.001 BTC
    expect(out).not.toMatch(/sat/i);
    expect(out).toMatch(/BTC|₿/);
    expect(result.current.isLoading).toBe(true);
  });
});

/**
 * A metered micropayment product routinely charges less than a cent per Cat
 * message. At CHF's 2-decimal precision those amounts formatted as "CHF 0.00" —
 * money genuinely spent, displayed as nothing. A credits ledger became a column
 * of zeros and a non-empty balance looked empty. BTC carries 8 decimals, so it
 * can always say what a fiat unit cannot.
 */
describe('amounts smaller than the display currency can express', () => {
  it('never renders a non-zero amount as zero — falls back to BTC', () => {
    mockCurrency = 'CHF';
    const { result } = renderHook(() => useDisplayCurrency());

    // 0.00000005 BTC * 86,000 = CHF 0.0043 → would print "CHF 0.00".
    const rendered = result.current.formatAmountBtc(0.00000005);
    expect(rendered).not.toBe('CHF 0.00');
    expect(rendered).toBe('₿0.00000005');
  });

  it('still uses fiat once the amount is large enough to express', () => {
    mockCurrency = 'CHF';
    const { result } = renderHook(() => useDisplayCurrency());

    // 0.0000001 BTC * 86,000 = CHF 0.0086 → rounds to CHF 0.01, which is honest.
    expect(result.current.formatAmountBtc(0.0000001)).toBe('CHF 0.01');
  });

  it('leaves a true zero rendered in the display currency', () => {
    mockCurrency = 'CHF';
    const { result } = renderHook(() => useDisplayCurrency());
    expect(result.current.formatAmountBtc(0)).toBe('CHF 0.00');
  });
});
