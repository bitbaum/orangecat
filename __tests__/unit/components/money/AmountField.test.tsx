// @vitest-environment jsdom
/**
 * AmountField — the field where a wrong number costs real money.
 *
 * Two failure modes are worth more than the rest combined:
 *
 *  - Emitting 0 BTC because the exchange rate had not loaded. `convertToBTC`
 *    returns 0 in that state, so "20" would become a real, silently wrong
 *    amount. The field must fall back to BTC entry instead.
 *  - Emitting a different number than the one on screen — a fiat round-trip
 *    that drifts a preset, or a silent clamp of an out-of-range amount.
 */

import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AmountField } from '@/components/money/AmountField';

const RATE_CHF_PER_BTC = 100_000;

let mockCurrency = 'CHF';
let ratesLoaded = true;

vi.mock('@/hooks/useUserCurrency', () => ({
  useUserCurrency: () => mockCurrency,
}));
vi.mock('@/hooks/useCurrencyConversion', () => ({
  useCurrencyConversion: () => ({
    isLoading: false,
    convertToBTC: (amount: number, from: string) =>
      from === 'BTC' ? amount : ratesLoaded ? amount / RATE_CHF_PER_BTC : 0,
    convertFromBTC: (btc: number, to: string) =>
      to === 'BTC' ? btc : ratesLoaded ? btc * RATE_CHF_PER_BTC : 0,
  }),
}));
vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (btc: number) => `CHF ${(btc * RATE_CHF_PER_BTC).toFixed(2)}`,
  }),
}));

const BOUNDS = { minBtc: 0.000001, maxBtc: 0.1 };

/**
 * Rendered the way it is actually used: a controlled field whose parent holds
 * the BTC amount. Range messages read the value the PARENT settled on, so a
 * harness that never updates would report no errors and prove nothing.
 */
function setup(over: Partial<React.ComponentProps<typeof AmountField>> = {}) {
  const onChange = vi.fn();

  function Harness() {
    const [btc, setBtc] = useState(over.value ?? 0);
    return (
      <AmountField
        {...BOUNDS}
        presetsBtc={[0.0001, 0.001]}
        {...over}
        value={btc}
        onChange={next => {
          onChange(next);
          setBtc(next);
        }}
      />
    );
  }

  const utils = render(<Harness />);
  const input = screen.getByRole('textbox');
  return { onChange, input, ...utils };
}

beforeEach(() => {
  mockCurrency = 'CHF';
  ratesLoaded = true;
  vi.clearAllMocks();
});

describe('entering an amount in the currency you think in', () => {
  it('converts what you typed into BTC', () => {
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: '20' } });

    // 20 CHF at 100k/BTC.
    expect(onChange).toHaveBeenLastCalledWith(0.0002);
  });

  it('accepts a comma as the decimal separator', () => {
    // Half of Europe types one, and `type="number"` rejects it outright.
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: '12,50' } });

    expect(onChange).toHaveBeenLastCalledWith(0.000125);
  });

  it('ignores characters that are not part of a number', () => {
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: 'CHF 20abc' } });

    expect(onChange).toHaveBeenLastCalledWith(0.0002);
  });

  it('reports zero for an emptied field rather than the last value', () => {
    const { onChange, input } = setup({ value: 0.0002 });

    fireEvent.change(input, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('selects the suggested amount on focus so typing replaces it', () => {
    // The field arrives pre-filled. Without select-on-focus the first keystroke
    // APPENDS, and "27.50" typed over a suggested "5.18" becomes "27.51850" —
    // an amount the payer never chose. Caught by driving the real page.
    const { input } = setup({ value: 0.0001 });

    fireEvent.focus(input);

    expect((input as HTMLInputElement).selectionStart).toBe(0);
    expect((input as HTMLInputElement).selectionEnd).toBe((input as HTMLInputElement).value.length);
  });

  it('always shows what actually moves', () => {
    setup({ value: 0.00025 });

    expect(screen.getByText(/0\.00025 BTC/)).toBeInTheDocument();
  });
});

describe('a missing exchange rate is never silently a zero', () => {
  it('falls back to BTC entry when rates are unavailable', () => {
    ratesLoaded = false;
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: '0.0002' } });

    // Typed in BTC and taken at face value — NOT converted to 0.
    expect(onChange).toHaveBeenLastCalledWith(0.0002);
    expect(input).toHaveAttribute('aria-label', expect.stringContaining('BTC'));
  });

  it('enters in BTC directly for a user whose display currency is BTC', () => {
    mockCurrency = 'BTC';
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: '0.05' } });

    expect(onChange).toHaveBeenLastCalledWith(0.05);
  });
});

describe('suggestions are exact', () => {
  it('emits the preset’s own BTC value, not a fiat round-trip', () => {
    const { onChange } = setup();

    fireEvent.click(screen.getByRole('button', { name: 'CHF 10.00' }));

    expect(onChange).toHaveBeenLastCalledWith(0.0001);
  });

  it('marks the chosen suggestion as selected', () => {
    setup({ value: 0.001 });

    expect(screen.getByRole('button', { name: 'CHF 100.00' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('suggests round amounts in the currency being typed', () => {
    // A BTC-round ladder shown to someone entering CHF reads "CHF 0.52 · CHF
    // 2.59 · CHF 5.18" — arithmetic noise nobody would pick on purpose. Found
    // by looking at the rendered page.
    setup({ presetsBtc: undefined });

    for (const label of ['CHF 1', 'CHF 5', 'CHF 10', 'CHF 20', 'CHF 50']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('spaces an alphabetic currency code but not a symbol glyph', () => {
    // "CHF 5" and "$5" are both right; "CHF5" and "$ 5" are both wrong.
    setup({ presetsBtc: undefined });
    expect(screen.getByRole('button', { name: 'CHF 5' })).toBeInTheDocument();

    cleanup();
    mockCurrency = 'USD';
    setup({ presetsBtc: undefined });
    expect(screen.getByRole('button', { name: '$5' })).toBeInTheDocument();
  });

  it('labels a suggestion as the round number it is, with no trailing zeros', () => {
    // The rung was picked BECAUSE it is round, so it has to read as one.
    // Converting it to BTC and formatting back gives "CHF 5.00" at best and
    // "CHF 4.99" at worst, which makes a deliberate number look accidental.
    setup({ presetsBtc: undefined });

    for (const button of screen.getAllByRole('button')) {
      expect(button.textContent).not.toMatch(/\.\d*0$/);
    }
  });

  it('suggests round BTC amounts when entering in BTC', () => {
    mockCurrency = 'BTC';
    setup({ presetsBtc: undefined });

    expect(screen.getByRole('button', { name: '0.0001 BTC' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /CHF/ })).not.toBeInTheDocument();
  });

  it('hides suggestions that fall outside the allowed range', () => {
    setup({ maxBtc: 0.0005 });

    expect(screen.queryByRole('button', { name: 'CHF 100.00' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CHF 10.00' })).toBeInTheDocument();
  });
});

describe('out of range says so instead of quietly changing the number', () => {
  it('reports an amount above the maximum without clamping it', () => {
    const { onChange, input } = setup();

    fireEvent.change(input, { target: { value: '99999' } });

    expect(onChange).toHaveBeenLastCalledWith(0.99999);
    expect(screen.getByText(/above the maximum/)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('reports an amount below the minimum', () => {
    const { input } = setup();

    fireEvent.change(input, { target: { value: '0.05' } });

    expect(screen.getByText(/below the minimum/)).toBeInTheDocument();
  });

  it('says nothing about range for a valid amount', () => {
    setup({ value: 0.0002 });

    expect(screen.queryByText(/maximum|minimum/)).not.toBeInTheDocument();
  });
});

describe('switching the entry unit re-expresses, never re-values', () => {
  it('keeps the same BTC amount when switching to BTC entry', () => {
    const { onChange } = setup({ value: 0.0002 });

    fireEvent.click(screen.getByRole('button', { name: 'Enter in BTC' }));

    // The displayed unit changed; the amount did not.
    expect(screen.getByRole('textbox')).toHaveValue('0.0002');
    expect(onChange).not.toHaveBeenCalled();
  });
});
