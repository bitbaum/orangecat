// @vitest-environment jsdom
/**
 * An amount field sends what was typed (audit, 2026-10-07): with `min: 1` on a
 * price, typing 0.0005 BTC used to store 1 BTC and jump the field to "1".
 */
import { renderHook, act } from '@testing-library/react';
import { useCurrencyInput } from '@/components/ui/useCurrencyInput';

describe('useCurrencyInput', () => {
  it('never rewrites a typed amount to a limit', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('BTC', null, onChange, undefined, 'BTC', 'BTC', false)
    );
    act(() => {
      result.current.handleInputChange({
        target: { value: '0.0005' },
      } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(onChange).toHaveBeenLastCalledWith(0.0005);
  });

  it('a cleared field is null, not a limit', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useCurrencyInput('CHF', 5, onChange, undefined, 'CHF', 'CHF', false)
    );
    act(() => {
      result.current.handleInputChange({ target: { value: '' } } as React.ChangeEvent<HTMLInputElement>);
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
