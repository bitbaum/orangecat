'use client';

/**
 * AmountField — entering how much, the way people actually do it.
 *
 * What this replaces got the priority backwards: a row of preset pills, with
 * typing your own amount hidden behind a "Custom" button, in BTC decimals
 * (0.00005) that nobody reasons about. Every money app people already use —
 * Twint, Venmo, Revolut, Cash App — opens on a big amount you type first,
 * denominated in the currency you think in.
 *
 * So: the amount is the headline, it accepts typing immediately, and presets sit
 * underneath as SUGGESTIONS rather than as the only easy path.
 *
 * Three rules this field will not break:
 *
 *  1. You always see what actually moves. Entry is in your display currency,
 *     but Bitcoin is what leaves the wallet, so the BTC figure is on screen at
 *     all times — never a number you find out about afterwards.
 *
 *  2. A missing exchange rate is never silently a zero. `convertToBTC` returns 0
 *     when rates haven't loaded, so converting "20" would hand the caller
 *     0 BTC — a real amount, silently wrong. Without rates the field switches to
 *     BTC entry instead of guessing.
 *
 *  3. Out of range says so. Clamping a typed amount to the maximum without a
 *     word is how a payer sends a different number than the one they typed.
 *
 * `inputMode="decimal"` matters more than it looks: it gives phones the plain
 * number pad. `type="number"` gives iOS a spinner and rejects the comma half of
 * Europe types.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { CURRENCY_METADATA, type CurrencyCode } from '@/config/currencies';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';
import { AmountPresets } from './AmountPresets';
import { BTC_DECIMALS, sanitize, toDraft } from './amount-draft';

interface AmountFieldProps {
  /** The amount in BTC — the canonical unit, whatever the field is showing. */
  value: number;
  onChange: (btc: number) => void;
  minBtc: number;
  maxBtc: number;
  /**
   * Suggestions, in BTC. Defaults to the shared ladder for whichever unit the
   * payer is entering in — see CONTRIBUTION_QUICK_AMOUNTS_*.
   */
  presetsBtc?: readonly number[];
  label?: string;
  autoFocus?: boolean;
}

export function AmountField({
  value,
  onChange,
  minBtc,
  maxBtc,
  presetsBtc,
  label = 'Amount',
  autoFocus = false,
}: AmountFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const displayCurrency = useUserCurrency() as CurrencyCode;
  const { convertToBTC, convertFromBTC, isLoading } = useCurrencyConversion();
  const { formatAmountBtc } = useDisplayCurrency();

  // Rule 2: no rate, no fiat entry. Also lets a Bitcoin-native user opt in.
  const ratesUsable =
    !isLoading && displayCurrency !== 'BTC' && convertFromBTC(1, displayCurrency) > 0;
  const [preferBtcEntry, setPreferBtcEntry] = useState(false);
  const inBtc = preferBtcEntry || !ratesUsable;

  const unit: CurrencyCode = inBtc ? 'BTC' : displayCurrency;
  const decimals = CURRENCY_METADATA[unit].precision;
  const symbol = CURRENCY_METADATA[unit].symbol;

  const toBtc = useCallback(
    (entered: number) => (inBtc ? entered : convertToBTC(entered, displayCurrency)),
    [inBtc, convertToBTC, displayCurrency]
  );
  const fromBtc = useCallback(
    (btc: number) => (inBtc ? btc : convertFromBTC(btc, displayCurrency)),
    [inBtc, convertFromBTC, displayCurrency]
  );

  const [draft, setDraft] = useState(() => toDraft(fromBtc(value), decimals));

  // What the field itself last reported. Anything else arriving in `value` came
  // from outside — a pay link's suggested amount, a reset after sending — and
  // should be rendered. Typing must NOT round-trip through here, or the caret
  // jumps and half-typed numbers get reformatted under the user's fingers.
  const emitted = useRef(value);
  const emit = useCallback(
    (btc: number) => {
      emitted.current = btc;
      onChange(btc);
    },
    [onChange]
  );

  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setDraft(toDraft(fromBtc(value), decimals));
    }
    // fromBtc/decimals follow `unit`, which has its own effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Switching CHF ⇄ BTC re-expresses the same amount; it never changes it.
  useEffect(() => {
    setDraft(toDraft(fromBtc(emitted.current), decimals));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  const handleDraft = (raw: string) => {
    const next = sanitize(raw);
    setDraft(next);
    const parsed = parseFloat(next);
    emit(Number.isFinite(parsed) && parsed > 0 ? toBtc(parsed) : 0);
  };

  const choosePreset = (btc: number) => {
    haptic('tap');
    setDraft(toDraft(fromBtc(btc), decimals));
    // The preset's exact BTC value, not a fiat round-trip that would drift.
    emit(btc);
  };

  const tooSmall = value > 0 && value < minBtc;
  const tooLarge = value > maxBtc;
  const secondary = inBtc
    ? ratesUsable
      ? formatAmountBtc(value)
      : null
    : `${toDraft(value, BTC_DECIMALS) || '0'} BTC`;

  // A long figure steps down a size rather than overflow a phone. The input
  // carries .oc-figure-input, the one exemption from the 16px pin globals.css
  // puts on every text input (which silently flattened any size set here).
  const figureSize =
    draft.length <= 7 ? 'text-figure' : draft.length <= 10 ? 'text-4xl' : 'text-3xl';

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      {/*
        The amount is the point of the screen, so it is set like one: centred,
        large, on a surface of its own, with what actually moves (the BTC
        figure) and the unit switch tucked under it. Tapping anywhere on the
        surface puts the cursor in the number.
      */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'cursor-text rounded-xl border bg-surface-base px-4 pb-4 pt-6 text-center transition-colors',
          'focus-within:border-interactive',
          tooSmall || tooLarge ? 'border-status-negative' : 'border-subtle'
        )}
      >
        <div className="flex items-baseline justify-center gap-1.5">
          <span className="text-2xl font-medium text-fg-tertiary">{symbol}</span>
          <input
            ref={inputRef}
            id={inputId}
            // The plain number pad, and a comma-tolerant field. See the note above.
            inputMode="decimal"
            type="text"
            autoFocus={autoFocus}
            value={draft}
            onChange={e => handleDraft(e.target.value)}
            // The field arrives pre-filled with a suggestion, so the first
            // keystroke has to REPLACE it. Without this, tapping in and typing
            // "27.50" over a suggested "5.18" yields "27.51850" — a number the
            // payer never chose and might not read before confirming.
            onFocus={e => e.target.select()}
            placeholder="0"
            maxLength={12}
            aria-label={`${label} in ${unit}`}
            aria-invalid={tooSmall || tooLarge}
            // Width follows the digits (tabular, so one ch each), which keeps
            // the figure and its symbol centred as a single group.
            style={{ width: `${Math.max(draft.length, 1)}ch` }}
            className={cn(
              'oc-figure-input min-w-[1ch] max-w-full bg-transparent p-0 font-heading font-semibold tabular-nums tracking-display text-fg-primary outline-none',
              'placeholder:text-fg-muted',
              figureSize
            )}
          />
        </div>

        <div className="mt-2 flex min-h-5 flex-col items-center gap-1 text-xs">
          {/* Rule 1: what actually moves, always on screen. */}
          <span className="tabular-nums text-fg-tertiary">{value > 0 ? secondary : null}</span>
        </div>
        {ratesUsable && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setPreferBtcEntry(v => !v);
            }}
            className="mt-1 inline-flex min-h-11 items-center px-3 text-xs text-fg-tertiary underline underline-offset-2 hover:text-fg-secondary"
          >
            {inBtc ? `Enter in ${displayCurrency}` : 'Enter in BTC'}
          </button>
        )}
      </div>

      {(tooSmall || tooLarge) && (
        <p className="text-sm text-status-negative">
          {tooSmall
            ? `That is below the minimum of ${formatAmountBtc(minBtc)}.`
            : `That is above the maximum of ${formatAmountBtc(maxBtc)}.`}
        </p>
      )}

      <AmountPresets
        value={value}
        onPick={choosePreset}
        inBtc={inBtc}
        minBtc={minBtc}
        maxBtc={maxBtc}
        presetsBtc={presetsBtc}
      />
    </div>
  );
}
