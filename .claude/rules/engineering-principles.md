# Core Engineering Principles

**Purpose**: Single source of truth for development principles - ALWAYS enforce these

**Last Updated**: 2026-09-04

---

## Critical: Always Follow These

### 1. DRY (Don't Repeat Yourself)

**Rule**: If you're copying code, STOP and create a shared utility instead.

**Examples**:

```typescript
// ❌ DON'T: Copy-paste API routes
// products/[id]/route.ts - 189 lines
// services/[id]/route.ts - 189 lines (95% identical)

// ✅ DO: Create generic handler
// lib/api/entityHandler.ts
export function createEntityCrudHandlers(entityType: EntityType) {
  const meta = ENTITY_REGISTRY[entityType];
  return {
    GET: createGetHandler(meta),
    POST: createPostHandler(meta),
    PUT: createPutHandler(meta),
    DELETE: createDeleteHandler(meta),
  };
}
```

**Self-Check Before Writing Code**:

- Does similar code exist elsewhere?
- Will this need to be reused?
- Can I abstract this pattern?

**Auto-Detection** (Post-hook):

```bash
# Check for duplicate code
pnpm exec jscpd src/ --threshold 0.1
```

---

### 2. SSOT (Single Source of Truth)

**Rule**: Every piece of data/config must live in exactly ONE place.

#### Critical SSOT Locations

**Entity Metadata**: `src/config/entity-registry.ts`

```typescript
// ✅ ALWAYS use registry
const meta = ENTITY_REGISTRY[entityType];
const table = meta.tableName;
const endpoint = meta.apiEndpoint;

// ❌ NEVER hardcode
const table = 'user_products'; // VIOLATION!
const endpoint = '/api/products'; // VIOLATION!
```

**Validation Schemas**: `src/lib/validation.ts`

```typescript
// ✅ Schema is source
const userProductSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
});

// ✅ Type derived from schema
type UserProduct = z.infer<typeof userProductSchema>;

// ❌ Don't define type separately
type UserProduct = {
  /* manual definition */
}; // VIOLATION!
```

**Navigation**: `src/config/navigation.ts`

```typescript
// ✅ Navigation from registry
const navItems = Object.values(ENTITY_REGISTRY).map(meta => ({
  name: meta.namePlural,
  href: meta.basePath,
  icon: meta.icon,
}));

// ❌ Hardcoded navigation
const navItems = [
  { name: 'Products', href: '/dashboard/store' }, // VIOLATION!
];
```

**Pre-Hook Check**:

```bash
# .claude/hooks/pre-edit.sh
# Block files with hardcoded entity names
if grep -E "user_products|user_services|user_causes" "$CLAUDE_EDITING_FILE"; then
  if [ "$CLAUDE_EDITING_FILE" != "src/config/entity-registry.ts" ]; then
    echo "❌ ERROR: Hardcoded entity names found. Use ENTITY_REGISTRY!" >&2
    exit 1
  fi
fi
```

---

### 3. Separation of Concerns

**Rule**: Each layer has ONE responsibility.

#### Layer Architecture

```
src/
├── domain/          # ✅ Business logic ONLY (no HTTP, no UI)
│   └── commerce/    # Product pricing, inventory logic
├── app/api/         # ✅ HTTP layer (thin, delegates to domain)
│   └── products/    # Request validation, response formatting
├── components/      # ✅ UI rendering (no business logic)
│   └── product/     # Display, user interaction
├── hooks/           # ✅ Data fetching, state management
│   └── useProducts  # API calls, caching, state
└── config/          # ✅ Static configuration
    └── entity-registry.ts
```

#### Examples

**✅ GOOD: Separated Concerns**

```typescript
// domain/commerce/service.ts
export class CommerceService {
  async calculateProductPrice(product: Product, quantity: number) {
    // Pure business logic
    return product.price_btc * quantity;
  }
}

// app/api/products/[id]/route.ts
export async function GET(request: Request) {
  // HTTP layer - thin wrapper
  const supabase = createServerClient();
  const commerce = new CommerceService(supabase);

  const product = await commerce.getProduct(id);
  return apiSuccess({ data: product });
}

// components/ProductCard.tsx
export function ProductCard({ product }: Props) {
  // UI only - displays data
  return (
    <Card>
      <CardTitle>{product.title}</CardTitle>
      <CardContent>{formatAmount(product.price_btc)}</CardContent>
    </Card>
  );
}
```

**❌ BAD: Mixed Concerns**

```typescript
// ❌ Component with business logic
export function ProductCard({ productId }: Props) {
  const [price, setPrice] = useState(0);

  // Business logic in component - VIOLATION!
  useEffect(() => {
    const calculatePrice = () => {
      // Complex pricing logic here...
    };
    setPrice(calculatePrice());
  }, [productId]);

  return <Card>Price: {price}</Card>;
}

// ❌ API route with UI concerns
export async function GET() {
  const product = await getProduct();
  // Formatting for UI - VIOLATION!
  return { displayName: `${product.title} (${product.status})` };
}
```

---

### 4. Modularity & Composability

**Rule**: Build small, focused modules that compose together.

#### Middleware Pattern

```typescript
// ✅ Small, focused middleware
export const withAuth = () => handler => {
  return async req => {
    const user = await getUser(req);
    if (!user) return apiError('Unauthorized', 401);
    return handler(req, { user });
  };
};

export const withRateLimit = (type: 'read' | 'write') => handler => {
  return async req => {
    const limited = await checkRateLimit(req, type);
    if (limited) return apiError('Too many requests', 429);
    return handler(req);
  };
};

// ✅ Compose them
export const GET = compose(
  withAuth(),
  withRateLimit('read'),
  withLogging()
)(async req => {
  // Handler logic
});
```

#### Component Composition

```typescript
// ✅ Small, reusable components
<EntityForm>
  <FormHeader />
  <TemplateSelector />
  <FormFields>
    <TextField name="title" />
    <TextArea name="description" />
    <NumberField name="price_btc" />
  </FormFields>
  <GuidancePanel />
  <FormActions />
</EntityForm>

// ❌ Monolithic component
<ProductForm>  {/* 800 lines of code */}
  {/* Everything in one component - VIOLATION! */}
</ProductForm>
```

---

### 5. Type Safety First

**Rule**: TypeScript everywhere, Zod for runtime validation.

#### Pattern

```typescript
// ✅ Schema is source of truth
export const createProductSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
  category: z.string().optional(),
});

// ✅ Type derived from schema
type CreateProductInput = z.infer<typeof createProductSchema>;

// ✅ Use in API
export async function POST(request: Request) {
  const body = await request.json();
  const result = createProductSchema.safeParse(body);

  if (!result.success) {
    return apiValidationError(result.error);
  }

  const validData: CreateProductInput = result.data;
  // Now TypeScript knows exact shape
}
```

**Post-Hook Enforcement**:

```bash
# .claude/hooks/post-edit.sh
# Run type checker after every edit
pnpm run type-check 2>&1 | tee /tmp/type-errors.log
if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo "❌ Type errors detected. Claude will self-correct:" >&2
  cat /tmp/type-errors.log >&2
fi
```

---

## Anti-Patterns to REJECT

### 1. Copy-Paste Programming

**When you see yourself copying code**:

1. ❌ STOP immediately
2. ✅ Extract to shared function/component
3. ✅ Parameterize differences
4. ✅ Delete duplicates

### 2. Magic Strings

**Never write**:

```typescript
// ❌ All of these are VIOLATIONS
'user_products';
'/api/products';
'Product';
'/dashboard/store';
```

**Always use**:

```typescript
// ✅ From registry
ENTITY_REGISTRY.product.tableName;
ENTITY_REGISTRY.product.apiEndpoint;
ENTITY_REGISTRY.product.name;
ENTITY_REGISTRY.product.basePath;
```

### 3. God Components

**If a component > 300 lines**:

1. Extract smaller components
2. Move logic to hooks
3. Use composition pattern

### 4. Premature Abstraction

**Wait for pattern to appear 2-3 times**:

- 1 instance: Write specific code
- 2 instances: Note the pattern
- 3 instances: Extract abstraction

---

## Entity Registry Pattern (CRITICAL)

### The SSOT for All Entities

**Location**: `src/config/entity-registry.ts`

```typescript
export const ENTITY_REGISTRY: Record<EntityType, EntityMetadata> = {
  product: {
    type: 'product',
    name: 'Product',
    namePlural: 'Products',
    tableName: 'user_products',
    basePath: '/dashboard/store',
    createPath: '/dashboard/store/create',
    apiEndpoint: '/api/products',
    icon: Package,
    color: 'blue',
    // ... all metadata
  },
  // ... other entities
};
```

### Usage (ALWAYS)

```typescript
// ✅ Get entity metadata
const meta = ENTITY_REGISTRY[entityType];

// ✅ Use in queries
const { data } = await supabase
  .from(meta.tableName)
  .select('*');

// ✅ Use in navigation
router.push(meta.createPath);

// ✅ Use in UI
<meta.icon className="h-5 w-5" />
<h1>{meta.name}</h1>
```

### Adding New Entity

```bash
# 1. Add to registry
# Edit src/config/entity-registry.ts

# 2. Create config
# Create src/config/entity-configs/new-entity.ts

# 3. Create schema
# Add to src/lib/validation.ts

# 4. Create migration: add supabase/migrations/YYYYMMDDHHMMSS_create_user_newentity_table.sql
#    (applied automatically on deploy by scripts/apply-migrations.sh)

# 5. Done! Everything else is automatic
```

---

## Schema Composition Pattern

### Base Schema + Extensions

```typescript
// ✅ Base for ALL entities
export const baseEntitySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'active', 'paused']).default('draft'),
  tags: z.array(z.string()).optional(),
});

// ✅ Entity-specific extensions
export const productSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
  category: z.string().optional(),
  inventory: z.number().int().min(0).optional(),
});

export const eventSchema = baseEntitySchema.extend({
  start_date: z.date(),
  end_date: z.date(),
  location: z.string().min(1),
  max_attendees: z.number().int().positive().optional(),
});

export const serviceSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
  duration_minutes: z.number().int().positive().optional(),
  availability: z.string().optional(),
});
```

**Benefits**:

- Common fields shared across entities
- Type safety maintained
- Easy to add new entities
- Validation consistent

---

## Review Checklist (Pre-Commit)

**Before suggesting any commit**:

- [ ] **DRY**: Is any code duplicated? Could it be shared?
- [ ] **SSOT**: Is data defined in multiple places?
- [ ] **Entity Registry**: If entity-related, does it use registry?
- [ ] **Consistency**: Does it follow patterns used by similar features?
- [ ] **Type Safety**: Are types properly defined? Input validated?
- [ ] **Error Handling**: Are errors handled consistently?
- [ ] **Separation**: Is business logic in domain layer?
- [ ] **Test Coverage**: Are there tests for new logic?

---

## Automated Enforcement

### Pre-Hook: Prevent Violations

```bash
#!/bin/bash
# .claude/hooks/pre-edit.sh

# Check for hardcoded entity names
if grep -E "user_products|user_services" "$CLAUDE_EDITING_FILE"; then
  if [ "$CLAUDE_EDITING_FILE" != "src/config/entity-registry.ts" ]; then
    echo "❌ Hardcoded entity names. Use ENTITY_REGISTRY!" >&2
    exit 1
  fi
fi

# Check for magic string API endpoints
if grep -E '"/api/(products|services|causes)"' "$CLAUDE_EDITING_FILE"; then
  if [ "$CLAUDE_EDITING_FILE" != "src/config/entity-registry.ts" ]; then
    echo "❌ Hardcoded API endpoints. Use ENTITY_REGISTRY!" >&2
    exit 1
  fi
fi
```

### Post-Hook: Verify Compliance

```bash
#!/bin/bash
# .claude/hooks/post-edit.sh

# Type check
pnpm run type-check 2>&1 | tee /tmp/type-errors.log

# Lint check
pnpm run lint 2>&1 | tee /tmp/lint-errors.log

# Check for duplicates
pnpm exec jscpd src/ --threshold 0.1 2>&1 | tee /tmp/duplicate-code.log

# Report to Claude via stderr for self-correction
if [ -s /tmp/type-errors.log ] || [ -s /tmp/lint-errors.log ]; then
  echo "❌ Issues detected. Fix required:" >&2
  cat /tmp/type-errors.log /tmp/lint-errors.log >&2
  exit 1
fi
```

---

## Migration Guide

**When you find violations**:

1. **Identify the pattern**: What should be shared?
2. **Extract to shared module**: Create utility/component
3. **Update one entity**: Verify it works
4. **Update remaining entities**: Apply consistently
5. **Add tests**: Prevent regression
6. **Document**: Update this guide if needed

---

## References

- **Entity Registry**: `src/config/entity-registry.ts`
- **Validation**: `src/lib/validation.ts`
- **API Middleware**: `src/lib/api/compose.ts`
- **Commerce Service**: `src/domain/commerce/service.ts`
- **Full Engineering Principles**: `docs/development/ENGINEERING_PRINCIPLES.md`

---

**Remember**: Every line of code is a line to maintain. Every pattern is a pattern users learn. Make both count.
