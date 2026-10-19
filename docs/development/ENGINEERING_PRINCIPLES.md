# Engineering Principles & Best Practices

## (Also known as: Dev Guide)

> **Purpose**: This document is the Single Source of Truth for all development principles.
> Every code change should be evaluated against these principles.

---

## Core Principles

### 1. DRY (Don't Repeat Yourself)

- **Definition**: Every piece of knowledge should have a single, unambiguous representation
- **In Practice**:
  - Extract repeated code into shared functions/utilities
  - If you copy-paste code, it should become a shared module
  - Look for patterns across similar features (products, services, projects)

**Bad Example**:

```typescript
// products/[id]/route.ts - 189 lines
// services/[id]/route.ts - 189 lines (95% identical)
// causes/[id]/route.ts - 186 lines (95% identical)
```

**Good Example**:

```typescript
// lib/api/genericCrudHandler.ts
export function createCrudRoutes(entityType: EntityType) {
  // Shared logic, entity-specific differences from registry
}
```

### 2. SSOT (Single Source of Truth)

- **Definition**: Each piece of data/config should be defined in exactly one place
- **In Practice**:
  - Use `entity-registry.ts` for all entity metadata
  - Database schema defines structure, types derive from it
  - API endpoints, paths, names come from registry

**Bad Example**:

```typescript
// Hardcoded in products/route.ts
const { items } = await listEntitiesPage('user_products', ...);

// Hardcoded in services/route.ts
const { items } = await listEntitiesPage('user_services', ...);
```

**Good Example**:

```typescript
import { ENTITY_REGISTRY } from '@/config/entity-registry';

// Dynamic from registry
const table = ENTITY_REGISTRY[entityType].tableName;
const { items } = await listEntitiesPage(table, ...);
```

### 3. Separation of Concerns

- **Layers**:
  - **Domain** (`src/domain/`): Business logic, entities, validation
  - **API** (`src/app/api/`): HTTP layer, request/response handling
  - **Components** (`src/components/`): UI rendering
  - **Hooks** (`src/hooks/`): Data fetching, state management
  - **Config** (`src/config/`): Static configuration, metadata

- **Rules**:
  - Domain layer should not know about HTTP
  - Components should not contain business logic
  - API routes should be thin - delegate to domain services

### 4. Modularity & Composability

- **Build small, focused modules**
- **Compose functionality through middleware**

**Example - API Middleware Pattern**:

```typescript
export const GET = compose(
  withRequestId(), // Adds request ID
  withRateLimit('read') // Rate limiting
)(async request => {
  // Handler logic
});
```

### 5. Type Safety

- **TypeScript everywhere**
- **Zod for runtime validation**
- **Derive types from schemas when possible**

```typescript
// Schema is the source
const userProductSchema = baseEntitySchema.extend({
  price_sats: z.number().positive(),
});

// Type derived from schema
type UserProduct = z.infer<typeof userProductSchema>;
```

---

## Architectural Patterns

### Entity Registry Pattern

All entity types (products, services, causes, projects, etc.) should be:

1. **Defined in `src/config/entity-registry.ts`**
2. **Referenced by type, never hardcoded**

```typescript
// entity-registry.ts is the SSOT
export const ENTITY_REGISTRY: Record<EntityType, EntityMetadata> = {
  product: {
    type: 'product',
    name: 'Product',
    tableName: 'user_products', // Database table
    basePath: '/dashboard/store',
    createPath: '/dashboard/store/create',
    apiEndpoint: '/api/products',
    // ... all metadata
  },
  // ...
};
```

### Generic CRUD Pattern

Entity CRUD operations should use shared handlers:

```typescript
// lib/api/entityHandler.ts
export async function handleEntityGet(entityType: EntityType, id: string, supabase) {
  const meta = ENTITY_REGISTRY[entityType];
  const { data, error } = await supabase.from(meta.tableName).select('*').eq('id', id).single();

  if (error) return { error: `${meta.name} not found` };
  return { data };
}
```

### Schema Composition Pattern

Entities share common fields; extract base schema:

```typescript
// Base schema for ALL entities
export const baseEntitySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'active', 'paused']).default('draft'),
});

// Entity-specific extensions
export const userProductSchema = baseEntitySchema.extend({
  price_sats: z.number().positive(),
  category: z.string().optional(),
});
```

---

## Code Quality Standards

### Consistency

- All similar features should follow identical patterns
- If Products use compose() middleware, so should Services, Causes, Projects
- If one entity has a feature, decide: all entities get it, or none

### Error Handling

- Use standardized response helpers (`apiSuccess`, `apiError`, `apiNotFound`)
- Never return raw errors to clients
- Log detailed errors server-side

### Naming Conventions

- **Components**: PascalCase (`EntityCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useEntityList`)
- **Utilities**: camelCase (`formatPrice`, `getPagination`)
- **Constants**: UPPER_SNAKE_CASE (`ENTITY_REGISTRY`)
- **Types/Interfaces**: PascalCase (`EntityMetadata`)

### File Organization

```
src/
├── app/api/              # API routes (thin layer)
├── components/           # UI components
│   ├── ui/              # Generic UI (Button, Card)
│   ├── entity/          # Entity-specific (EntityCard, EntityForm)
│   └── layout/          # Layout components
├── config/               # Static configuration
│   ├── entity-registry.ts
│   └── entity-configs/   # Form configurations
├── domain/               # Business logic
│   ├── commerce/        # Shared commerce logic
│   └── [entity]/        # Entity-specific extensions
├── hooks/                # React hooks
├── lib/                  # Utilities
│   ├── api/             # API helpers
│   ├── supabase/        # Database client
│   └── validation.ts    # Zod schemas
└── types/                # TypeScript types
```

---

## Anti-Patterns to Avoid

### 1. Copy-Paste Programming

❌ Copying an API route and changing entity name
✅ Creating a generic handler that accepts entity type

### 2. Magic Strings

❌ `supabase.from('user_products')` scattered everywhere
✅ `supabase.from(ENTITY_REGISTRY[entityType].tableName)`

### 3. Inconsistent Patterns

❌ Products uses compose(), Causes doesn't
✅ All entities use identical middleware pattern

### 4. God Components

❌ 500-line component handling all entity types with switch statements
✅ Generic component + entity-specific configuration

### 5. Premature Optimization

❌ Complex abstractions for one use case
✅ Wait for pattern to emerge 2-3 times, then abstract

---

## Review Checklist

Before merging any PR, verify:

- [ ] **DRY**: Is any code duplicated? Could it be shared?
- [ ] **SSOT**: Is data defined in multiple places?
- [ ] **Consistency**: Does it follow the pattern used by similar features?
- [ ] **Type Safety**: Are types properly defined? Is input validated?
- [ ] **Error Handling**: Are errors handled consistently?
- [ ] **Registry Usage**: If entity-related, does it use the registry?

---

## Migration Guide

When you find violations, fix them incrementally:

1. **Identify the pattern** - What should be shared?
2. **Extract to shared module** - Create utility/component
3. **Update one entity** - Verify it works
4. **Update remaining entities** - Apply consistently
5. **Add tests** - Prevent regression
6. **Document** - Update this guide if needed

---

## References

- Entity Registry: `src/config/entity-registry.ts`
- API Middleware: `src/lib/api/compose.ts`
- Validation Schemas: `src/lib/validation/` (barrel `index.ts`)
- Commerce Service: `src/domain/commerce/service.ts`

---

_Last Updated: 2025-12-25_
_Maintainers: All developers should contribute to and follow these principles_
