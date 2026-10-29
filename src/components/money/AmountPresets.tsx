'use client';

/**
 * The suggested amounts under an amount field — one row of equal cells.
 *
 * Suggestions are a convenience, never the only easy path: typing is. Each rung
 * carries the label it was round in. A ladder rung is chosen because it is a
 * round number, so it has to READ as one: converting the fiat rung to BTC and
 * formatting it back gives "CHF 5.00" at best and "CHF 4.99" at worst — the
 * trailing zeros are noise and the drift makes a deliberate number look
 * accidental. So the rung labels itself in its own unit; only a caller-supplied
 * BTC ladder is formatted.
 */

import { useMemo } from 'react';
import { useUserCurrency } from '@/hooks/useUserCurrency';
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { CURRENCY_METADATA, type CurrencyCode } from '@/config/currencies';
import {
  CONTRIBUTION_QUICK_AMOUNTS_BTC,
  CONTRIBUTION_QUICK_AMOUNTS_FIAT,
} from '@/config/payment-presets';
import { cn } from '@/lib/utils';
import { BTC_DECIMALS, toDraft } from './amount-draft';

/** Suggestions are one row of equal cells; four is what a phone fits readably. */
const PRESET_CELLS = 4;

/**
 * "CHF 5" but "$5" — an alphabetic code is a word and takes a space, a glyph
 * hugs its number. Getting this backwards is the kind of small wrongness that
 * makes a payment screen feel machine-generated.
 */
const ALPHABETIC_SYMBOL = /^[A-Za-z]+$/;

interface AmountPresetsProps {
  /** The amount now, in BTC — the chosen rung is the one it matches. */
  value: number;
  onPick: (btc: number) => void;
  /** Whether the field is entering in BTC (a fiat ladder makes no sense then). */
  inBtc: boolean;
  minBtc: number;
  maxBtc: number;
  /** A caller's own ladder, in BTC; defaults to the shared one for the unit. */
  presetsBtc?: readonly number[];
}

export function AmountPresets({
  value,
  onPick,
  inBtc,
  minBtc,
  maxBtc,
  presetsBtc,
}: AmountPresetsProps) {
  const displayCurrency = useUserCurrency() as CurrencyCode;
  const { convertToBTC } = useCurrencyConversion();
  const { formatAmountBtc } = useDisplayCurrency();
  const symbol = CURRENCY_METADATA[displayCurrency].symbol;

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

  if (presets.length === 0) {
    return null;
  }

  return (
    // Equal cells in one row, never pills that wrap wherever the words run
    // out — a row of choices is one row (AGENTS.md → "One shape per kind, here").
    <div className="grid grid-cols-4 gap-2">
      {presets.map(({ btc, label }) => {
        const chosen = Math.abs(value - btc) < btc * 0.001;
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPick(btc)}
            aria-pressed={chosen}
            className={cn(
              'min-h-11 min-w-0 truncate rounded-md border px-2 text-sm tabular-nums transition-colors',
              chosen
                ? 'border-interactive bg-surface-raised text-fg-primary'
                : 'border-default text-fg-secondary hover:text-fg-primary'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
