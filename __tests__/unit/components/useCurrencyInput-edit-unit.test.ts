// @vitest-environment jsdom
/**
 * #1677 review: an amount typed in CHF for a field kept in BTC.
 * - The unit is fixed when the edit starts. Worked out afresh per keystroke, a
 *   rate expiring mid-edit flipped it to BTC and "30000" CHF became 30000 BTC.
 * - The converted amount is rounded to eight places, so what validation sees
 *   is what is saved.
 */
import { renderHook, act } from '@testing-library/react';
import { useCurrencyInput } from '@/components/ui/useCurrencyInput';
import { applyRateSnapshot, cache } from '@/services/currency/rates';

const type = (h: { current: ReturnType<typeof useCurrencyInput> }, value: string) =>
  act(() => {
    h.current.handleInputChange({ target: { value } } as React.ChangeEvent<HTMLInputElement>);
  });

describe('an amount typed in CHF for a field kept in BTC', () => {
  beforeEach(() => {
    cache.rates = {};
    cache.expiresAt = null;
    applyRateSnapshot({ rates: { CHF: 100_000 }, fetchedAt: Date.now() });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays in CHF for the whole edit when the rate expires part way', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('BTC', null, onChange, undefined, 'CHF', 'CHF', false, 'CHF')
    );
    expect(result.current.inputCurrency).toBe('CHF');
    type(result, '3000');
    expect(onChange).toHaveBeenLastCalledWith(0.03);

    cache.expiresAt = new Date(Date.now() - 1);
    type(result, '30000');
    expect(result.current.inputCurrency).toBe('CHF');
    expect(onChange).toHaveBeenLastCalledWith(0.3);
  });

  it('sends the BTC amount rounded to eight places', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('BTC', null, onChange, undefined, 'CHF', 'CHF', false, 'CHF')
    );
    type(result, '1.234567');
    expect(onChange).toHaveBeenLastCalledWith(0.00001235);
    type(result, '0.0004');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });
});
