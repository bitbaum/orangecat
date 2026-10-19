# Currency System Explained

**Created:** 2026-01-05  
**Last Modified:** 2026-06-15  
**Last Modified Summary:** Complete explanation of currency system, conversions, and BTC transactions

## Overview

This document explains how the currency system works end-to-end: from user input, through database storage, to BTC transactions, and back to display.

## Key Principle: BTC is the Source of Truth

**All amounts are stored in Bitcoin as `NUMERIC(18,8)` in the database.** Satoshis are display-only (shown when the user selects SATS as their currency). Other currencies are also for display and input purposes only. All transactions settle in Bitcoin.

## What Happens When User Chooses USD as Default Currency?

### 1. User Preference Storage

When a user changes their currency preference to USD in settings:

```typescript
// Stored in profiles.currency
profiles.currency = 'USD';
```

**Database:** The `profiles` table has a `currency` column that stores the user's preference. This is the SSOT for user's display currency.

### 2. Creating an Entity (e.g., Event)

**Scenario:** User with USD preference creates an event with ticket price $50

#### Step 1: Form Input

```typescript
// User sees form with CurrencyInput component
// Input currency defaults to user's preference (USD)
<CurrencyInput
  defaultCurrency="USD"  // From profiles.currency
  userCurrency="USD"
  value={ticketPriceSats}  // Always stored as sats
  onChange={(sats) => setTicketPriceSats(sats)}
/>
```

#### Step 2: User Enters Amount

```typescript
// User types: "50"
// CurrencyInput converts USD → SATS in real-time
const sats = convertToSats(50, 'USD');
// Example: 50 USD → ~515,463 sats (at ~$97,000/BTC)
```

#### Step 3: Form Submission

```typescript
// Form data sent to API:
{
  ticket_price_sats: 515463,  // Always in satoshis
  currency: 'USD'             // Display currency only
}
```

#### Step 4: API Handler

```typescript
// src/app/api/events/route.ts
transformData: async (data, userId, supabase) => {
  // Get user's preferred currency (USD in this case)
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();

  const userCurrency = profile?.currency || 'CHF';

  // Set currency field (for display purposes)
  if (!data.currency) {
    data.currency = userCurrency; // 'USD'
  }

  // ticket_price_sats is already in satoshis (from CurrencyInput)
  return data;
};
```

#### Step 5: Database Storage

```sql
-- events table
INSERT INTO events (
  ticket_price_sats,  -- 515463 (stored as bigint)
  currency,            -- 'USD' (display only)
  ...
) VALUES (
  515463,
  'USD',
  ...
);
```

**Key Point:** The database stores:

- `ticket_price_sats = 515463` (the actual amount in satoshis)
- `currency = 'USD'` (just metadata for display)

### 3. Displaying the Event

When displaying the event to users:

```typescript
// Get event from database
const event = {
  ticket_price_sats: 515463,
  currency: 'USD',
};

// Display to different users:
// User A (prefers USD): $50.00
// User B (prefers CHF): CHF 43.00
// User C (prefers EUR): €47.00

// Conversion happens on-the-fly:
const displayAmount = convertFromSats(515463, userCurrency);
// User A: convertFromSats(515463, 'USD') → 50.00
// User B: convertFromSats(515463, 'CHF') → 43.00
```

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER INPUT (USD)                                            │
│ User types: "50" in CurrencyInput with currency="USD"        │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND CONVERSION                                         │
│ convertToSats(50, 'USD') → 515463 sats                     │
│ CurrencyInput.onChange(515463)                              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ FORM SUBMISSION                                             │
│ {                                                           │
│   ticket_price_sats: 515463,  // Always sats                │
│   currency: 'USD'            // Display currency            │
│ }                                                           │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ API HANDLER                                                 │
│ - Validates data                                            │
│ - Sets currency from user preference if not provided        │
│ - ticket_price_sats already in satoshis                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE STORAGE                                            │
│ events.ticket_price_sats = 515463  (bigint)                │
│ events.currency = 'USD'  (text, display only)              │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│ DISPLAY (Different Users See Different Amounts)            │
│ User A (USD): convertFromSats(515463, 'USD') → $50.00      │
│ User B (CHF): convertFromSats(515463, 'CHF') → CHF 43.00  │
│ User C (EUR): convertFromSats(515463, 'EUR') → €47.00     │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### Amount Storage

All monetary amounts are stored in **satoshis** (bigint):

```sql
-- Events
ticket_price_sats bigint        -- Actual amount
funding_goal_sats bigint         -- Actual amount
currency text                    -- Display currency only

-- Products
price_sats bigint                -- Actual amount
currency text                    -- Display currency only

-- Services
hourly_rate_sats bigint          -- Actual amount
fixed_price_sats bigint          -- Actual amount
currency text                    -- Display currency only

-- Projects
goal_amount bigint               -- Actual amount (in sats)
currency text                    -- Display currency only

-- Loans
amount_sats bigint               -- Actual amount
currency text                    -- Display currency only
```

### Currency Column Purpose

The `currency` column serves **two purposes**:

1. **Display preference** - What currency the creator used when entering the amount
2. **Default display** - When showing to users who haven't set a preference

**Important:** The currency column does NOT affect the stored amount. `ticket_price_sats` is always in satoshis regardless of the currency value.

## Conversion Functions

### Frontend Conversion (`src/services/currency/index.ts`)

```typescript
// Convert user input to satoshis (for storage)
convertToSats(amount: number, fromCurrency: Currency): number

// Convert satoshis to display currency (for showing)
convertFromSats(sats: number, toCurrency: Currency): number

// Convert between any two currencies (via sats)
convert(amount: number, fromCurrency: Currency, toCurrency: Currency): number
```

### Example Conversions

```typescript
// USD → SATS
convertToSats(50, 'USD');
// At $97,000/BTC: 50 / 97000 * 100000000 = 515,463 sats

// SATS → USD
convertFromSats(515463, 'USD');
// 515463 / 100000000 * 97000 = $50.00

// USD → CHF (via sats)
convert(50, 'USD', 'CHF');
// USD → SATS → CHF
// 50 USD → 515463 sats → 43.33 CHF (at CHF 84,000/BTC)
```

## Exchange Rates

Exchange rates are cached and updated periodically:

```typescript
// Default rates (from src/services/currency/index.ts)
BTC_USD: 97000;
BTC_EUR: 91000;
BTC_CHF: 86000;
BTC_SATS: 100000000; // Fixed: 1 BTC = 100M sats
```

Rates are fetched from `/api/currency/rates` and cached for 5 minutes.

## BTC Transactions

### How Transactions Work

1. **All transactions are in Bitcoin** - No matter what currency the user sees
2. **Amounts are in satoshis** - The smallest unit of Bitcoin
3. **Conversion happens at display time** - Not at transaction time

### Example: Buying an Event Ticket

```
User sees: $50.00 ticket
Database has: 515463 sats
Transaction: Send 515463 sats to event's Bitcoin address
```

The transaction always uses the satoshi amount, regardless of what currency the user saw.

## User Currency Preference Flow

### Setting Preference

```typescript
// User changes currency in settings
profiles.currency = 'USD';

// This affects:
// 1. Default currency in forms
// 2. Display currency throughout app
// 3. Default currency when creating entities
```

### Using Preference

```typescript
// When creating entity
const userCurrency = useUserCurrency(); // 'USD'
<CurrencyInput defaultCurrency={userCurrency} />

// When displaying entity
const displayAmount = convertFromSats(amountSats, userCurrency);
```

## Database Defaults vs User Preference

### Database Default

- **Default:** `'CHF'` (platform default)
- **Purpose:** Used when user hasn't set a preference
- **Stored in:** Database column default

### User Preference

- **Source:** `profiles.currency`
- **Overrides:** Database default when creating entities
- **Stored in:** User's profile

### Priority Order

1. **Explicitly provided** currency (user selects in form)
2. **User's preference** (`profiles.currency`)
3. **Platform default** (`'CHF'`)

## Common Scenarios

### Scenario 1: User Creates Event with USD Preference

```
1. User has profiles.currency = 'USD'
2. User creates event, enters $50
3. CurrencyInput converts: 50 USD → 515463 sats
4. Form submits: { ticket_price_sats: 515463, currency: 'USD' }
5. Database stores: ticket_price_sats=515463, currency='USD'
6. Other users see converted amounts in their preferred currency
```

### Scenario 2: User Updates Currency Preference

```
1. User changes profiles.currency from 'CHF' to 'USD'
2. Existing entities keep their original currency
3. New entities default to 'USD'
4. Display converts all amounts to 'USD' for this user
```

### Scenario 3: Multiple Users View Same Event

```
Event: ticket_price_sats = 515463, currency = 'USD'

User A (USD preference): Sees $50.00
User B (CHF preference): Sees CHF 43.00
User C (EUR preference): Sees €47.00

All see the same satoshi amount, displayed in their preferred currency
```

## Key Takeaways

1. **Database always stores satoshis** - `*_sats` columns are the source of truth
2. **Currency is display metadata** - `currency` column is for UI purposes only
3. **User preference affects defaults** - New entities use user's preferred currency
4. **Conversion is real-time** - Happens on input and display, not storage
5. **All transactions are in BTC** - Regardless of display currency
6. **Exchange rates are cached** - Updated every 5 minutes
7. **Database defaults to CHF** - But user preference overrides

## Files Involved

- **Config:** `src/config/currencies.ts` - SSOT for currency codes
- **Conversion:** `src/services/currency/index.ts` - Conversion functions
- **Input:** `src/components/ui/CurrencyInput.tsx` - Currency input component
- **API:** `src/app/api/events/route.ts` - Uses user preference
- **Database:** the `*_currency_check` constraints in the squashed baseline `supabase/migrations/20240101000001_baseline_public_schema.sql`

## Testing

To verify the system works:

1. Set user currency to USD in settings
2. Create an event with $50 ticket price
3. Check database: `ticket_price_sats` should be in satoshis (~515463)
4. Check database: `currency` should be 'USD'
5. View event as different users - each should see their preferred currency
6. Verify transaction uses satoshi amount, not fiat amount
