# Currency Architecture

**Status**: Proposed
**Created**: 2026-01-07
**Author**: Architecture Review

---

## Philosophy

```
BTC = The only real value (truth)
All other currencies = Display formats (lenses on truth)
```

- **BTC is what people send and receive**
- **CHF, EUR, USD, SATS** are how humans perceive/label that value
- Goal completion = BTC truth viewed through goal's currency lens

---

## Core Principles

| Principle         | Implementation                                    |
| ----------------- | ------------------------------------------------- |
| **SSOT**          | `src/config/currencies.ts` defines all currencies |
| **DRY**           | One converter, one formatter - no duplication     |
| **Extensible**    | Add currency = one config entry                   |
| **No hardcoding** | No scattered `if currency === 'X'` checks         |
| **Clean naming**  | No `_sats` suffixes - BTC is the base             |

---

## Storage Model

### BTC Amounts (Actual Value)

```sql
-- Store as NUMERIC(20,8) - BTC with 8 decimal precision
funded_btc    NUMERIC(20,8)   -- 0.12345678 BTC
balance_btc   NUMERIC(20,8)   -- Actual BTC held
amount_btc    NUMERIC(20,8)   -- Transaction amount
```

**Why NUMERIC(20,8)?**

- 8 decimals = Bitcoin's native precision
- NUMERIC is exact (no floating point errors)
- Can store up to 21 million BTC
- Column name reflects reality: it's BTC

### Goals/Prices (User Intent)

```sql
-- User's mental model - any currency
goal_amount     NUMERIC(20,2)   -- The number (10000.00)
goal_currency   TEXT            -- Currency code ('CHF')
price_amount    NUMERIC(20,2)   -- Price in user's currency
price_currency  TEXT            -- Currency code
```

---

## SSOT: Currency Configuration

```typescript
// src/config/currencies.ts

export const CURRENCIES = {
  // Fiat
  CHF: {
    code: 'CHF',
    symbol: 'CHF',
    name: 'Swiss Franc',
    decimals: 2,
    type: 'fiat',
  },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, type: 'fiat' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, type: 'fiat' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, type: 'fiat' },

  // Bitcoin representations
  BTC: {
    code: 'BTC',
    symbol: '₿',
    name: 'Bitcoin',
    decimals: 8,
    type: 'crypto',
    isBtcBase: true, // This IS the base
  },
  SATS: {
    code: 'SATS',
    symbol: 'sats',
    name: 'Satoshis',
    decimals: 0,
    type: 'crypto',
    btcMultiplier: 100_000_000, // Display multiplier from BTC
  },

  // Future: just add here
  // JPY: { code: 'JPY', symbol: '¥', name: 'Yen', decimals: 0, type: 'fiat' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];
export const PLATFORM_DEFAULT_CURRENCY: CurrencyCode = 'CHF';
```

---

## Converter Service

```typescript
// src/services/currency/converter.ts

import { CURRENCIES, CurrencyCode } from '@/config/currencies';
import { getExchangeRate } from './rates';

/**
 * Convert BTC to any display currency
 */
export function convertBtcTo(btcAmount: number, targetCurrency: CurrencyCode): number {
  const currency = CURRENCIES[targetCurrency];

  // BTC to BTC - no conversion
  if (targetCurrency === 'BTC') {
    return btcAmount;
  }

  // BTC to SATS - multiply by precision
  if ('btcMultiplier' in currency) {
    return btcAmount * currency.btcMultiplier;
  }

  // BTC to Fiat - use exchange rate
  const rate = getExchangeRate('BTC', targetCurrency);
  return btcAmount * rate;
}

/**
 * Convert any currency to BTC
 */
export function convertToBtc(amount: number, fromCurrency: CurrencyCode): number {
  const currency = CURRENCIES[fromCurrency];

  if (fromCurrency === 'BTC') {
    return amount;
  }

  if ('btcMultiplier' in currency) {
    return amount / currency.btcMultiplier;
  }

  const rate = getExchangeRate('BTC', fromCurrency);
  return amount / rate;
}

/**
 * Convert between any two currencies (via BTC)
 */
export function convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return amount;
  const btc = convertToBtc(amount, from);
  return convertBtcTo(btc, to);
}
```

---

## Formatter Service

```typescript
// src/services/currency/formatter.ts

import { CURRENCIES, CurrencyCode } from '@/config/currencies';

export function formatCurrency(
  amount: number,
  currency: CurrencyCode,
  options: { compact?: boolean; showSymbol?: boolean } = {}
): string {
  const { compact = false, showSymbol = true } = options;
  const config = CURRENCIES[currency];

  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: compact ? 0 : config.decimals,
    maximumFractionDigits: config.decimals,
  });

  if (!showSymbol) return formatted;

  // Position symbol appropriately
  switch (currency) {
    case 'SATS':
      return `${formatted} sats`;
    case 'BTC':
      return `₿${formatted}`;
    case 'CHF':
      return `CHF ${formatted}`;
    default:
      return `${config.symbol}${formatted}`;
  }
}
```

---

## Goal Completion Service

```typescript
// src/services/goals/checker.ts

import { convertBtcTo } from '@/services/currency/converter';
import { CurrencyCode } from '@/config/currencies';

export interface GoalProgress {
  currentValue: number; // In goal's currency
  goalAmount: number; // Goal amount
  currency: CurrencyCode; // Goal's currency
  percentComplete: number;
  isComplete: boolean;
  fundedBtc: number; // Actual BTC (truth)
}

export function checkGoalProgress(
  goalAmount: number,
  goalCurrency: CurrencyCode,
  fundedBtc: number
): GoalProgress {
  // Convert BTC truth to goal's currency lens
  const currentValue = convertBtcTo(fundedBtc, goalCurrency);
  const percentComplete = goalAmount > 0 ? (currentValue / goalAmount) * 100 : 0;

  return {
    currentValue,
    goalAmount,
    currency: goalCurrency,
    percentComplete,
    isComplete: currentValue >= goalAmount,
    fundedBtc,
  };
}
```

---

## Database Schema Changes

### Before (Current)

```sql
goal_sats         BIGINT        -- Confusing: is this goal or storage?
funded_sats       BIGINT        -- Implies sats is special
price_sats        BIGINT        -- Same issue
amount_sats       BIGINT        -- Same issue
currency          TEXT          -- Display currency
```

### After (Proposed)

```sql
-- Goals/Prices: User's intent in their currency
goal_amount       NUMERIC(20,2) -- 10000.00
goal_currency     TEXT          -- 'CHF'
price_amount      NUMERIC(20,2) -- Price in display currency
price_currency    TEXT          -- 'CHF'

-- Actual BTC received/held
funded_btc        NUMERIC(20,8) -- 0.12345678
balance_btc       NUMERIC(20,8) -- Actual BTC
amount_btc        NUMERIC(20,8) -- Transaction amount
```

---

## Migration Strategy

### Phase 1: Add New Columns

```sql
-- Add new properly-named columns alongside old ones
ALTER TABLE user_causes
  ADD COLUMN goal_amount NUMERIC(20,2),
  ADD COLUMN funded_btc NUMERIC(20,8);

-- Migrate data
UPDATE user_causes SET
  goal_amount = goal_sats / 100000000.0 * (
    CASE currency
      WHEN 'SATS' THEN 1
      WHEN 'BTC' THEN 100000000
      ELSE (SELECT rate FROM currency_rates WHERE code = currency)
    END
  ),
  funded_btc = funded_sats / 100000000.0;
```

### Phase 2: Update Application Code

- Update all references from `_sats` to new columns
- Use converter service everywhere
- Remove hardcoded conversions

### Phase 3: Remove Old Columns

```sql
ALTER TABLE user_causes
  DROP COLUMN goal_sats,
  DROP COLUMN funded_sats;
```

---

## Example Flow: Fundraising Project

**Setup:**

```
User creates project:
  goal_amount = 10000
  goal_currency = 'CHF'
  funded_btc = 0
```

**Day 1:** Someone donates 0.1 BTC (rate: 1 BTC = 86,000 CHF)

```
funded_btc = 0.1
Display: convertBtcTo(0.1, 'CHF') = 8,600 CHF
Progress: 8,600 / 10,000 = 86%
```

**Day 2:** Another 0.02 BTC donation

```
funded_btc = 0.12
Display: convertBtcTo(0.12, 'CHF') = 10,320 CHF
Progress: 10,320 / 10,000 = 103%
Goal REACHED (via donation)
```

**Alternative Day 2:** No donation, but BTC rises to 100,000 CHF

```
funded_btc = 0.1 (unchanged)
Display: convertBtcTo(0.1, 'CHF') = 10,000 CHF
Progress: 10,000 / 10,000 = 100%
Goal REACHED (via appreciation)
```

---

## Files to Modify

| File                                 | Change                      |
| ------------------------------------ | --------------------------- |
| `src/config/currencies.ts`           | Add btcMultiplier, clean up |
| `src/services/currency/converter.ts` | New unified converter       |
| `src/services/currency/formatter.ts` | Clean formatter             |
| `src/services/goals/checker.ts`      | New goal checker            |
| `supabase/migrations/xxx.sql`        | Schema migration            |
| All `*_sats` references              | Update to new columns       |

---

## Benefits

1. **Conceptual clarity**: BTC is truth, currencies are views
2. **Extensibility**: Add JPY, CNY, etc. with one config line
3. **No special cases**: SATS is just another display format
4. **Clean naming**: Columns reflect what they store
5. **Goal flexibility**: Works for any currency goal
6. **Price appreciation**: Fiat goals can complete via BTC rise

---

## Implementation Status

### Completed (2026-01-07)

1. **Currency SSOT** (`src/config/currencies.ts`)
   - Added `CurrencyConfig` interface with `isBtcBase` and `btcMultiplier`
   - BTC marked as base (`isBtcBase: true`)
   - SATS has `btcMultiplier: 100_000_000`
   - Easy to add new currencies (just add to CURRENCIES object)
   - Derived types: `FiatCurrency`, `CryptoCurrency`, `CurrencyCode`

2. **Unified Converter Service** (`src/services/currency/index.ts`)
   - `convertBtcTo(btc, targetCurrency)` - Primary function
   - `convertToBtc(amount, fromCurrency)` - Convert to truth
   - `convert(amount, from, to)` - Any-to-any via BTC
   - Goal completion checker: `checkGoalProgress(goalAmount, goalCurrency, fundedBtc)`
   - `btcNeededForGoal(goalAmount, goalCurrency, fundedBtc)`
   - Legacy functions deprecated but still available

3. **DRY Cleanup**
   - `src/types/settings.ts` now imports from SSOT instead of duplicating
   - Centralized currency definitions

### Pending

1. **Database Migration** - Requires careful planning
   - Convert BIGINT sats columns to NUMERIC(20,8) BTC
   - Add `_currency` columns for goal currencies
   - Migrate existing data
   - Already partial migration in `20260105000001_remove_sats_terminology.sql`

2. **Code Updates** - Update remaining \_sats references in codebase
   - Components still use `convertFromSats` (deprecated)
   - Need to update to `convertBtcTo` pattern

---

## Questions for Review

1. Should we keep BIGINT storage (efficient) with renamed columns, or switch to NUMERIC(20,8)?
2. Migration timeline: big bang or incremental?
3. Should we add a `currency_rates` table with historical data?
