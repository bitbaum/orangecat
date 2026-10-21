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

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { CURRENCY_METADATA, type CurrencyCode } from '@/config/currencies';
import {
  CONTRIBUTION_QUICK_AMOUNTS_BTC,
  CONTRIBUTION_QUICK_AMOUNTS_FIAT,
} from '@/config/payment-presets';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptics';

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

const BTC_DECIMALS = CURRENCY_METADATA.BTC.precision;

/** Suggestions are one row of equal cells; four is what a phone fits readably. */
const PRESET_CELLS = 4;

/**
 * "CHF 5" but "$5" — an alphabetic code is a word and takes a space, a glyph
 * hugs its number. Getting this backwards is the kind of small wrongness that
 * makes a payment screen feel machine-generated.
 */
const ALPHABETIC_SYMBOL = /^[A-Za-z]+$/;

/** A value the input can hold: plain digits, no thousands separators. */
function toDraft(amount: number, decimals: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    return '';
  }
  return amount.toFixed(decimals).replace(/\.?0+$/, '');
}

/** Accept what a European keyboard produces; keep one separator, digits only. */
function sanitize(raw: string): string {
  const unified = raw.replace(',', '.').replace(/[^\d.]/g, '');
  const [head, ...rest] = unified.split('.');
  return rest.length > 0 ? `${head}.${rest.join('')}` : head;
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

  /**
   * Suggestions, each carrying the label it was round in.
   *
   * A ladder rung is chosen because it is a round number, so it has to READ as
   * one. Converting the fiat rung to BTC and formatting it back gives
   * "CHF 5.00" at best and "CHF 4.99" at worst — the trailing zeros are noise
   * and the drift makes a deliberate number look accidental. The rung labels
   * itself in its own unit; only a caller-supplied BTC ladder is formatted.
   */
  const presets = useMemo(() => {
    const ladder = presetsBtc
      ? presetsBtc
          .filter(btc => btc > 0 && btc >= minBtc && btc <= maxBtc)
          .map(btc => ({
            btc,
            label: inBtc ? `${toDraft(btc, BTC_DECIMALS)} BTC` : formatAmountBtc(btc),
          }))
      : inBtc
        ? CONTRIBUTION_QUICK_AMOUNTS_BTC.filter(btc => btc >= minBtc && btc <= maxBtc).map(btc => ({
            btc,
            label: `${toDraft(btc, BTC_DECIMALS)} BTC`,
          }))
        : CONTRIBUTION_QUICK_AMOUNTS_FIAT.map(fiat => ({
            btc: convertToBTC(fiat, displayCurrency),
            label: `${symbol}${ALPHABETIC_SYMBOL.test(symbol) ? ' ' : ''}${fiat}`,
          })).filter(p => p.btc > 0 && p.btc >= minBtc && p.btc <= maxBtc);
    // The row is four equal cells; the largest rungs are the ones people pick.
    return ladder.slice(-PRESET_CELLS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetsBtc, inBtc, displayCurrency, symbol, minBtc, maxBtc]);

  const tooSmall = value > 0 && value < minBtc;
  const tooLarge = value > maxBtc;
  const secondary = inBtc
    ? ratesUsable
      ? formatAmountBtc(value)
      : null
    : `${toDraft(value, BTC_DECIMALS) || '0'} BTC`;

  return (
    <div className="space-y-3">
      <label htmlFor={inputId} className="block text-sm font-medium text-fg-primary">
        {label}
      </label>

      <div
        className={cn(
          'flex items-baseline gap-2 rounded-lg border bg-surface-base px-4 py-3 transition-colors',
          'focus-within:border-accent-primary',
          tooSmall || tooLarge ? 'border-status-negative' : 'border-default'
        )}
      >
        <span className="text-lg font-medium text-fg-tertiary">{symbol}</span>
        <input
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
          aria-label={`${label} in ${unit}`}
          aria-invalid={tooSmall || tooLarge}
          className="min-h-11 w-full bg-transparent text-3xl font-semibold tabular-nums text-fg-primary outline-none placeholder:text-fg-tertiary"
        />
      </div>

      <div className="flex min-h-5 items-center justify-between gap-3 text-xs">
        {/* Rule 1: what actually moves, always on screen. */}
        <span className="tabular-nums text-fg-tertiary">{value > 0 ? secondary : null}</span>
        {ratesUsable && (
          <button
            type="button"
            onClick={() => setPreferBtcEntry(v => !v)}
            className="shrink-0 underline underline-offset-2 text-fg-tertiary hover:text-fg-secondary"
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

      {presets.length > 0 && (
        // Equal cells in one row, never pills that wrap wherever the words run
        // out — a row of choices is one row (CLAUDE.md → "Design discipline").
        <div className="grid grid-cols-4 gap-2">
          {presets.map(({ btc, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => choosePreset(btc)}
              aria-pressed={Math.abs(value - btc) < btc * 0.001}
              className={cn(
                'min-h-11 min-w-0 truncate rounded-md border px-2 text-sm tabular-nums transition-colors',
                Math.abs(value - btc) < btc * 0.001
                  ? 'border-interactive bg-surface-raised text-fg-primary'
                  : 'border-default text-fg-secondary hover:text-fg-primary'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
