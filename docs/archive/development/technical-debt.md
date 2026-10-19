# Technical Debt & Code Quality Issues

**Last Updated**: 2025-06-05

## 🔴 High Priority

### 1. Analytics Page - Currency Hardcoding

**File**: `src/app/(authenticated)/dashboard/analytics/page.tsx`
**Lines**: 240, 242, 301, 304, 319

**Issue**: The analytics page has hardcoded currency formatting that:

- Assumes all amounts are in BTC
- Uses manual sats conversion
- Doesn't respect project currency settings
- Duplicates currency logic instead of using CurrencyDisplay component

**Impact**:

- Shows incorrect currency for CHF/EUR/USD projects
- Violates DRY principles
- Not using single source of truth for currency conversion

**Fix Required**:

```tsx
// BEFORE (lines 155-160)
const formatCurrency = (amount: number) => {
  if (amount >= 1) {
    return `₿${amount.toFixed(6)}`;
  }
  return `${(amount * 100_000_000).toFixed(0)} sats`;
};

// AFTER - Use CurrencyDisplay component
<CurrencyDisplay amount={project.totalRaised} currency={project.currency || 'CHF'} />;
```

**Estimate**: 2-3 hours to refactor properly with project currency awareness

---

### 2. Mixed Currency Aggregation

**Files**: Multiple dashboard pages

**Issue**: When calculating totals across projects with different currencies (CHF + BTC + EUR), the code:

- Previously summed incompatible units
- Now uses primary currency (CHF or BTC)
- Should ideally show grouped totals or clear BTC equivalents

**Current Solution**:

- Dashboard shows primary currency total
- Projects page shows BTC equivalents
- This is acceptable but could be improved

**Future Enhancement**:

- Multi-currency display showing breakdown by currency
- Clear conversion rates displayed
- User preference for display currency

---

## 🟡 Medium Priority

### 3. Analytics Page Metric Calculations

**File**: `src/app/(authenticated)/dashboard/analytics/page.tsx`
**Lines**: 68-130

**Issue**: Metric calculations don't account for different project currencies

**Example**:

```tsx
const totalRaised = projects.reduce((sum, c) => sum + (c.total_funding || 0), 0);
// Problem: Adds 1000 CHF + 0.5 BTC = 1000.5 (meaningless)
```

**Fix**: Use currency converter service to normalize all amounts to BTC or user's preferred currency

---

### 4. Duplicate Currency Utilities

**Files**:

- `src/services/currencyConverter.ts` (✅ Correct - Single source of truth)
- `src/utils/currency.ts` (⚠️ Has overlapping functionality)

**Issue**: Two different currency utility files with similar functionality

**Recommendation**:

- Keep `currencyConverter.ts` as primary service (fetches live rates)
- Deprecate or consolidate `currency.ts`
- Update all imports to use `currencyConverter`

---

## 🟢 Low Priority / Code Quality

### 5. Component Organization

**Current State**: Project-related components scattered

**Improvement**:

- ✅ Created `src/components/projects/ProjectTile.tsx`
- Consider creating more reusable components:
  - `CurrencyWithEquivalent.tsx` - Shows amount + BTC equivalent
  - `ProjectStatusBadge.tsx` - Standardized status badges
  - `ProjectProgress.tsx` - Progress bar with metrics

---

### 6. Type Safety for Currency

**Current**: Currency fields are `string` type

**Enhancement**: Use discriminated union type

```tsx
type SupportedCurrency = 'BTC' | 'SATS' | 'CHF' | 'USD' | 'EUR';

interface Project {
  currency: SupportedCurrency;
  // ... other fields
}
```

**Benefit**: TypeScript will catch invalid currency codes at compile time

---

## ✅ Recently Fixed

### Fixed: Dashboard Currency Display

- ✅ Removed hardcoded `currency="BTC"` from dashboard
- ✅ Now uses `project.currency || 'CHF'`
- ✅ Shows correct currency for all projects

### Fixed: Project Tiles Inconsistency

- ✅ Created standardized ProjectTile component
- ✅ Consistent heights using flexbox
- ✅ Line clamping prevents overflow
- ✅ Shows primary currency + BTC equivalent

### Fixed: Delete Confirmation Dialog

- ✅ Shows correct currency for individual projects
- ✅ Shows BTC equivalent for bulk deletions

### Fixed: Projects Dashboard

- ✅ Uses CurrencyDisplay component
- ✅ BTC equivalent calculations
- ✅ No more hardcoded "sats" strings

---

## Best Practices Implemented

### DRY (Don't Repeat Yourself)

- ✅ Created reusable ProjectTile component
- ✅ Created useCurrencyConversion hook
- ✅ Using CurrencyDisplay component everywhere

### Single Source of Truth

- ✅ Currency conversion: `src/services/currencyConverter.ts`
- ✅ Currency display: `src/components/ui/CurrencyDisplay.tsx`
- ✅ Project data: `src/stores/projectStore.ts`

### Modularity

- ✅ Separated concerns: display, conversion, data
- ✅ Hooks for reusable logic
- ✅ Components for reusable UI

---

## Action Items

### Immediate (Next Sprint)

1. [ ] Refactor analytics page to use CurrencyDisplay
2. [ ] Add currency-aware calculations to analytics metrics
3. [ ] Add BTC equivalent helper to all currency displays

### Future

1. [ ] Consolidate currency utilities
2. [ ] Add TypeScript discriminated unions for currencies
3. [ ] Create comprehensive currency display component library
4. [ ] Add user preference for display currency
5. [ ] Add multi-currency breakdown widgets

---

## Notes

- Exchange rates cached for 1 minute (see `currencyConverter.ts:25`)
- Fallback rates: BTC/CHF 95,550, BTC/USD 105,000
- CoinGecko API used for live rates (free tier)
