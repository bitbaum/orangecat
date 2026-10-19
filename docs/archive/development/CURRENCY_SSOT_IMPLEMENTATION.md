# Currency Single Source of Truth Implementation

**Created:** 2026-01-05  
**Last Modified:** 2026-01-05  
**Last Modified Summary:** Established currency SSOT with user preference support

## Overview

This document describes the Single Source of Truth (SSOT) implementation for currency handling across the application.

## Key Principles

1. **All transactions are in BTC** - Currency is ONLY for display and input purposes
2. **Default currency is CHF** - Platform default (Swiss-focused)
3. **User preference overrides default** - Users can set their preferred currency in settings
4. **Config is SSOT** - `src/config/currencies.ts` is the ONLY place currency codes are defined

## Single Source of Truth

**File:** `src/config/currencies.ts`

```typescript
export const CURRENCY_CODES = ['USD', 'EUR', 'CHF', 'BTC', 'SATS'] as const;
export const PLATFORM_DEFAULT_CURRENCY: CurrencyCode = 'CHF';
```

### Rules

- ✅ All database CHECK constraints MUST match `CURRENCY_CODES`
- ✅ All validation schemas MUST use `CURRENCY_CODES`
- ✅ All UI components MUST use `CURRENCY_CODES`
- ✅ Database defaults MUST use `PLATFORM_DEFAULT_CURRENCY` ('CHF')
- ❌ NEVER hardcode currency lists in migrations
- ❌ NEVER hardcode currency defaults in handlers

## User Currency Preference

Users can set their preferred currency in their profile (`profiles.currency`). This preference:

1. **Overrides platform default** when creating entities
2. **Is used for display** throughout the application
3. **Falls back to CHF** if not set or invalid

### Implementation

```typescript
// Get user's preferred currency from profile
const { data: profile } = await supabase
  .from('profiles')
  .select('currency')
  .eq('id', userId)
  .single();

const userCurrency = profile?.currency && 
  CURRENCY_CODES.includes(profile.currency) 
  ? profile.currency 
  : PLATFORM_DEFAULT_CURRENCY;
```

## Database Schema

### Currency Column Defaults

All currency columns default to `'CHF'` (platform default):

```sql
ALTER TABLE public.events 
  ALTER COLUMN currency SET DEFAULT 'CHF';
```

### Currency Constraints

All currency columns use the same CHECK constraint matching `CURRENCY_CODES`:

```sql
ALTER TABLE public.events 
  ADD CONSTRAINT events_currency_check 
  CHECK (currency IN ('USD', 'EUR', 'CHF', 'BTC', 'SATS'));
```

**Migration:** `supabase/migrations/20260105000000_unify_currency_constraints.sql`

## API Handlers

### POST Handlers (Create)

When creating entities, currency is set in this order:

1. **Provided value** (from form/request)
2. **User's preferred currency** (from `profiles.currency`)
3. **Platform default** (`PLATFORM_DEFAULT_CURRENCY` = 'CHF')

**Example:** `src/app/api/events/route.ts`

```typescript
transformData: async (data, userId, supabase) => {
  // Get user's preferred currency
  const { data: profile } = await supabase
    .from('profiles')
    .select('currency')
    .eq('id', userId)
    .single();
  
  const userCurrency = profile?.currency && 
    CURRENCY_CODES.includes(profile.currency) 
    ? profile.currency 
    : PLATFORM_DEFAULT_CURRENCY;
  
  // Use provided, user preference, or default
  if (!data.currency || data.currency === '') {
    data.currency = userCurrency;
  }
  
  return data;
}
```

### PUT Handlers (Update)

Currency is **only updated if explicitly provided**. No defaults are applied to prevent overwriting existing values.

**Example:** `src/app/api/events/[id]/route.ts`

```typescript
const buildEventUpdatePayload = createUpdatePayloadBuilder([
  // ... other fields ...
  // Currency: only include if explicitly provided
  // Currency is for display/input only - all transactions are in BTC
  { from: 'currency' },
]);
```

## Frontend

### User Currency Hook

`src/hooks/useUserCurrency.ts` provides the user's preferred currency:

```typescript
export function useUserCurrency(): Currency {
  const profile = useAuthStore((state) => state.profile);
  const profileCurrency = profile?.currency;
  
  if (profileCurrency && isSupportedCurrency(profileCurrency)) {
    return profileCurrency as Currency;
  }
  
  return PLATFORM_DEFAULT_CURRENCY; // Falls back to CHF
}
```

### Form Defaults

Entity forms use the user's preferred currency as the default:

```typescript
const userCurrency = useUserCurrency();
// Form defaults to userCurrency
```

## Migration Guide

When adding currency support to a new entity:

1. **Add currency column** with default `'CHF'`
2. **Add CHECK constraint** matching `CURRENCY_CODES`
3. **Update POST handler** to use user preference
4. **Update PUT handler** to only update if provided
5. **Update validation schema** to use `CURRENCY_CODES`

## Files Modified

### Core Config
- `src/config/currencies.ts` - SSOT definition

### Migrations
- `supabase/migrations/20260105000000_unify_currency_constraints.sql` - Unified constraints

### API Handlers
- `src/lib/api/entityPostHandler.ts` - Support async transformData with supabase
- `src/app/api/events/route.ts` - Use user preference
- `src/app/api/events/[id]/route.ts` - Remove currency default
- `src/app/api/products/[id]/route.ts` - Remove currency default
- `src/app/api/services/[id]/route.ts` - Remove currency default
- `src/app/api/projects/[id]/route.ts` - Remove currency default
- `src/app/api/loans/[id]/route.ts` - Remove currency default
- `src/app/api/causes/[id]/route.ts` - Remove currency default
- `src/app/api/assets/[id]/route.ts` - Remove currency default

## Testing Checklist

- [ ] User can create event with their preferred currency
- [ ] User can create event without currency (uses preference)
- [ ] User can update event without changing currency
- [ ] Database constraints match CURRENCY_CODES
- [ ] All entities use same currency pattern
- [ ] Migration applies successfully

## Notes

- Currency is **display/input only** - all transactions settle in BTC
- Database defaults to CHF, but user preference overrides on creation
- Update handlers don't set defaults to preserve existing values
- Config file is authoritative - database must match
