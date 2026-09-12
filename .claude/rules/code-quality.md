# Code Quality Standards

**Purpose**: Naming conventions, testing requirements, and quality metrics

**Last Updated**: 2026-09-04

---

## Naming Conventions

### Files & Directories

```
Components:     PascalCase.tsx        EntityCard.tsx
Utilities:      camelCase.ts          formatPrice.ts
Hooks:          useCamelCase.ts       useEntityList.ts
Types:          PascalCase.ts         EntityTypes.ts
Constants:      UPPER_SNAKE.ts        API_CONSTANTS.ts
Config:         kebab-case.ts         entity-registry.ts
```

### Code Elements

```typescript
// Components: PascalCase
export function EntityCard() {}
export const ProductList = () => {};

// Functions: camelCase
export function formatPrice(amount: number) {}
export const calculateTotal = items => {};

// Constants: UPPER_SNAKE_CASE
export const ENTITY_REGISTRY = {};
export const API_BASE_URL = 'https://api.example.com';

// Types/Interfaces: PascalCase
export interface EntityMetadata {}
export type EntityType = 'product' | 'service';

// Props: camelCase
interface ProductCardProps {
  entityType: EntityType;
  onEdit?: () => void;
}

// Variables: camelCase
const userProducts = [];
const totalPrice = 0;
```

---

## File Size Limits

**Enforce with post-hooks**:

```bash
#!/bin/bash
# Check file sizes after edit

file="$CLAUDE_EDITED_FILE"
lines=$(wc -l < "$file")

if [[ "$file" == *.tsx ]] && [ $lines -gt 300 ]; then
  echo "⚠️  Component too large: $file ($lines lines)" >&2
  echo "   Recommend: Extract smaller components" >&2
fi

if [[ "$file" == */api/* ]] && [ $lines -gt 150 ]; then
  echo "⚠️  API route too large: $file ($lines lines)" >&2
  echo "   Recommend: Move logic to domain service" >&2
fi
```

**Limits**:

- Components: Max 300 lines
- API routes: Max 150 lines (should be thin)
- Utilities: Max 200 lines
- Hooks: Max 200 lines
- Services: Max 500 lines

**If exceeding**:

1. Extract smaller modules
2. Move logic to appropriate layer
3. Use composition over complexity

---

## Import Organization

**Consistent order** (enforced by ESLint):

```typescript
// 1. External imports (alphabetical)
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';

// 2. Internal imports - UI components
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// 3. Internal imports - business logic
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { createProduct } from '@/domain/commerce/service';
import { useEntityList } from '@/hooks/useEntityList';

// 4. Relative imports
import { formatPrice } from '../utils';
import { ProductCard } from './ProductCard';

// 5. Types (last)
import type { EntityType, Product } from '@/types';
import type { ProductCardProps } from './types';

// 6. Styles (if any)
import styles from './ProductCard.module.css';
```

**Auto-organize**:

```bash
# In post-hook
pnpm dlx organize-imports-cli "$CLAUDE_EDITED_FILE"
```

---

## Comment Standards

### When to Comment

**1. Complex Algorithms**:

```typescript
// ✅ Explain WHY, not WHAT
// Using Damerau-Levenshtein distance for fuzzy matching
// because it handles transpositions better than standard Levenshtein
function fuzzyMatch(str1: string, str2: string): number {
  // Implementation...
}

// ❌ Obvious comment
// This function adds two numbers
function add(a: number, b: number) {
  return a + b;
}
```

**2. Non-Obvious Decisions**:

```typescript
// ✅ Explain rationale
// We cache for 5 minutes (not longer) because product prices
// can change frequently during sales events
const CACHE_TTL = 300;

// ❌ State the obvious
// Set cache to 300 seconds
const CACHE_TTL = 300;
```

**3. Workarounds**:

```typescript
// ✅ Document temporary solutions
// TODO: Remove after Supabase fixes JSONB indexing bug #12345
// Using text column as workaround for now
const metadata = JSON.stringify(data);

// ❌ No explanation
// Using stringify
const metadata = JSON.stringify(data);
```

### When NOT to Comment

**Self-documenting code is better**:

```typescript
// ❌ Don't state the obvious
// Get the user's products
const products = await getUserProducts(userId);

// Set the title
setTitle(newTitle);

// ✅ Good naming makes comments unnecessary
const userProducts = await getUserProducts(userId);
setTitle(newTitle);
```

**Use type annotations instead**:

```typescript
// ❌ Comment to explain type
// userProducts is an array of Product objects
const userProducts = await getUserProducts(userId);

// ✅ Type annotation is self-documenting
const userProducts: Product[] = await getUserProducts(userId);
```

---

## Error Messages

### User-Facing Messages

**Clear, actionable, friendly**:

```typescript
// ✅ Good user messages
'Failed to create product. Please check your internet connection and try again.';
'Product title must be between 1 and 100 characters.';
'This product name is already taken. Please choose a different name.';

// ❌ Technical jargon
'Error: PGRST116 - Row not found';
'Validation failed: title.min(1)';
'Network request failed with status 500';
```

### Developer-Facing Messages

**Detailed, contextual, debuggable**:

```typescript
// ✅ Good developer logs
console.error('[API Error] Failed to create product', {
  error: error.message,
  stack: error.stack,
  userId: user.id,
  productData: body,
  requestId: req.headers.get('x-request-id'),
  timestamp: new Date().toISO String(),
});

// ❌ Minimal logs
console.error('Error');
console.log(error);
```

---

## Testing Requirements

### Unit Tests

**Coverage targets**:

- Utilities: 100% coverage
- Hooks: 90% coverage (happy path + errors)
- Components: 80% coverage (key interactions)
- Services: 90% coverage (business logic critical)

**Example**:

```typescript
// formatPrice.test.ts
describe('formatPrice', () => {
  it('formats BTC correctly', () => {
    expect(formatPrice(0.001)).toBe('0.00100000 BTC');
    expect(formatPrice(0)).toBe('0.00000000 BTC');
    expect(formatPrice(1)).toBe('1.00000000 BTC');
  });

  it('formats fiat correctly', () => {
    expect(formatPrice(0.001, 'CHF')).toBe('CHF 86.00');
  });

  it('handles negative values', () => {
    expect(() => formatPrice(-100)).toThrow('Price cannot be negative');
  });
});
```

### Integration Tests

**Test layer boundaries**:

```typescript
// API endpoint integration test
describe('POST /api/products', () => {
  it('creates product with valid data', async () => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validProductData),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
  });
});
```

### E2E Tests

**Critical user flows**:

- Create product
- Edit profile
- Send message
- Make Bitcoin payment
- Switch context (individual ↔ group)

**With browser automation**:

```javascript
// Test product creation flow
test('user can create product', async () => {
  await navigate({ url: 'http://localhost:3001/dashboard/store' });
  await click({ element: 'Create button', ref: 'a[href*="/create"]' });

  await type({ element: 'Title', ref: 'input[name="title"]', text: 'Test Product' });
  await type({ element: 'Price', ref: 'input[name="price_btc"]', text: '0.001' });

  await click({ element: 'Submit', ref: 'button[type="submit"]' });
  await wait_for({ text: 'Product created successfully' });
});
```

---

## Performance Standards

### Core Web Vitals

**Targets**:

- **First Contentful Paint (FCP)**: < 1.5s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **Time to Interactive (TTI)**: < 3.0s
- **Cumulative Layout Shift (CLS)**: < 0.1
- **First Input Delay (FID)**: < 100ms

### Optimization Techniques

**1. Code Splitting**:

```typescript
// ✅ Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,  // Client-only if needed
});
```

**2. Memoization**:

```typescript
// ✅ Memo expensive renders
const ExpensiveComponent = React.memo(Component);

// ✅ useMemo for calculations
const sortedProducts = useMemo(
  () => products.sort((a, b) => a.price_btc - b.price_btc),
  [products]
);

// ✅ useCallback for stable references
const handleClick = useCallback(
  (id: string) => {
    performAction(id);
  },
  [performAction]
);
```

**3. Image Optimization**:

```tsx
// ✅ Next.js Image
<Image
  src="/product.jpg"
  width={800}
  height={600}
  alt="Product"
  priority={aboveFold}
  placeholder="blur"
/>
```

**4. Bundle Size**:

```bash
# Check bundle size after changes
pnpm run build
pnpm run analyze
```

---

## Git Commit Standards

### Conventional Commits

**Format**: `<type>(<scope>): <description>`

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (no functional changes)
- `perf`: Performance improvement
- `test`: Adding/updating tests
- `docs`: Documentation changes
- `chore`: Maintenance tasks
- `style`: Code formatting (no logic changes)

**Examples**:

```bash
feat(products): add warranty period field
fix(auth): resolve session expiry bug
refactor(api): extract entity handlers to factory
perf(images): lazy load product images
test(commerce): add unit tests for pricing logic
docs(readme): update setup instructions
chore(deps): update dependencies
```

### Commit Message Format

```
<type>(<scope>): <short description>

<longer description if needed>
- What changed
- Why it changed
- Any breaking changes

Closes #123
```

**Example**:

```
feat(products): add warranty period field

Added optional warranty_period field to products:
- Updated validation schema
- Created database migration
- Added form field to product creation

This enables sellers to specify warranty duration.

Closes #456
```

---

## Code Review Checklist

### Before Creating PR

- [ ] All tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm run type-check`)
- [ ] Linter passes (`pnpm run lint`)
- [ ] No console.logs in production code
- [ ] No commented-out code
- [ ] Follows naming conventions
- [ ] No hardcoded values (use ENTITY_REGISTRY)
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Empty states implemented
- [ ] Accessibility considerations
- [ ] Performance considerations

### Reviewer Checks

- [ ] Follows DRY principle (no duplication)
- [ ] Follows SSOT principle (data defined once)
- [ ] Uses ENTITY_REGISTRY for entity metadata
- [ ] Proper type safety (no `any`)
- [ ] Adequate test coverage
- [ ] Clear, descriptive variable names
- [ ] Proper error handling
- [ ] Security considerations
- [ ] Performance impact assessed
- [ ] Documentation updated if needed

---

## Automated Quality Checks

### Pre-Commit Hooks

```bash
#!/bin/bash
# .husky/pre-commit

# Type check
pnpm run type-check || exit 1

# Lint
pnpm run lint || exit 1

# Tests (only affected)
pnpm run test:changed || exit 1
```

### Post-Edit Hooks (Claude)

```bash
#!/bin/bash
# .claude/hooks/post-edit.sh

echo "🔍 Running quality checks..."

# Type check
pnpm run type-check 2>&1 | tee /tmp/type-errors.log

# Lint (with auto-fix)
pnpm run lint --fix 2>&1 | tee /tmp/lint-errors.log

# Check file size
lines=$(wc -l < "$CLAUDE_EDITED_FILE")
if [ $lines -gt 500 ]; then
  echo "⚠️  Large file: $CLAUDE_EDITED_FILE ($lines lines)"
fi

# Check for magic strings
if grep -E "user_products|user_services" "$CLAUDE_EDITED_FILE"; then
  if [[ "$CLAUDE_EDITED_FILE" != *"entity-registry"* ]]; then
    echo "❌ Hardcoded entity names found!"
    exit 1
  fi
fi

# Report errors for self-correction
if [ -s /tmp/type-errors.log ] || [ -s /tmp/lint-errors.log ]; then
  echo "❌ Issues detected. Fix required:" >&2
  cat /tmp/type-errors.log /tmp/lint-errors.log >&2
  exit 1
fi

echo "✅ All quality checks passed"
```

---

## Performance Monitoring

### Measure After Changes

```bash
# Lighthouse CI
pnpm run build
pnpm dlx lighthouse http://localhost:3001 --view

# Bundle analysis
pnpm run analyze

# Check specific metrics
pnpm dlx web-vitals-measure http://localhost:3001
```

### Performance Budget

```json
{
  "budgets": [
    {
      "resourceType": "script",
      "budget": 300
    },
    {
      "resourceType": "image",
      "budget": 200
    },
    {
      "metric": "interactive",
      "budget": 3000
    }
  ]
}
```

---

## Documentation Standards

### Code Documentation

**README.md** (for modules):

````markdown
# Module Name

## Purpose

What this module does and why it exists

## Usage

```typescript
// Example code
```
````

## API

- `functionName(param)` - Description

## Tests

How to run tests

````

**JSDoc** (for complex functions):
```typescript
/**
 * Calculates bulk pricing with discounts
 *
 * @param basePriceBtc - Base price per unit in BTC
 * @param quantity - Number of units
 * @returns Final price in BTC after discounts
 *
 * @example
 * calculateBulkPrice(0.0001, 10) // Returns 0.00009 (10% discount)
 */
export function calculateBulkPrice(
  basePriceBtc: number,
  quantity: number
): number {
  // Implementation
}
````

---

## References

- **ESLint Config**: `.eslintrc.json`
- **TypeScript Config**: `tsconfig.json`
- **Test Setup**: `vitest.config.ts`
- **Prettier Config**: `.prettierrc`
- **Husky Hooks**: `.husky/`

---

**Remember**: Code quality is not negotiable. Automated checks catch issues, reviews ensure adherence to principles.
