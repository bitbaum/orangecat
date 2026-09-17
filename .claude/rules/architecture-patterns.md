# Architecture Patterns

**Purpose**: System design patterns and architectural decisions for OrangeCat

**Last Updated**: 2026-09-04

---

## Entity Registry Pattern (CRITICAL)

### The Problem

Duplicated entity metadata across codebase leads to:

- Inconsistencies between components
- Maintenance burden (update in 20 places)
- Bugs when definitions drift
- Coupling between unrelated code

### The Solution: Central Registry

**Single Source of Truth** for all entity types

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
    editPath: id => `/dashboard/store/${id}/edit`,
    apiEndpoint: '/api/products',
    icon: Package,
    color: 'blue',
    description: 'Physical or digital goods for sale',
    fields: ['title', 'description', 'price_btc', 'category', 'inventory'],
    searchable: true,
    taggable: true,
  },
  service: {
    type: 'service',
    name: 'Service',
    namePlural: 'Services',
    tableName: 'user_services',
    basePath: '/dashboard/services',
    createPath: '/dashboard/services/create',
    editPath: id => `/dashboard/services/${id}/edit`,
    apiEndpoint: '/api/services',
    icon: Briefcase,
    color: 'purple',
    description: 'Professional services or consultations',
    fields: ['title', 'description', 'price_btc', 'duration_minutes'],
    searchable: true,
    taggable: true,
  },
  // ... other entities
};
```

### Usage Patterns

**In API Routes**:

```typescript
// ✅ Dynamic from registry
const meta = ENTITY_REGISTRY[entityType];
const { data } = await supabase.from(meta.tableName).select('*');

// ❌ Hardcoded
const { data } = await supabase.from('user_products').select('*');
```

**In Components**:

```typescript
// ✅ Dynamic rendering
function EntityIcon({ entityType }: Props) {
  const Icon = ENTITY_REGISTRY[entityType].icon;
  return <Icon className="h-5 w-5" />;
}

// ❌ Switch statement
function EntityIcon({ entityType }: Props) {
  switch (entityType) {
    case 'product': return <Package />;
    case 'service': return <Briefcase />;
    // ... repetitive!
  }
}
```

**In Navigation**:

```typescript
// ✅ Generated from registry
const navItems = Object.values(ENTITY_REGISTRY).map(meta => ({
  name: meta.namePlural,
  href: meta.basePath,
  icon: meta.icon,
}));

// ❌ Hardcoded list
const navItems = [
  { name: 'Products', href: '/dashboard/store', icon: Package },
  { name: 'Services', href: '/dashboard/services', icon: Briefcase },
  // ... repetitive!
];
```

### Adding New Entity

```bash
# 1. Add to registry
# Edit src/config/entity-registry.ts

export const ENTITY_REGISTRY = {
  // ... existing entities
  event: {
    type: 'event',
    name: 'Event',
    namePlural: 'Events',
    tableName: 'user_events',
    basePath: '/dashboard/events',
    createPath: '/dashboard/events/create',
    apiEndpoint: '/api/events',
    icon: Calendar,
    color: 'green',
    // ... metadata
  },
};

# 2. Create config (optional for custom behavior)
# Create src/config/entity-configs/event.ts

# 3. Create validation schema
# Add to src/lib/validation.ts
export const eventSchema = baseEntitySchema.extend({
  start_date: z.date(),
  end_date: z.date(),
  location: z.string(),
});

# 4. Create database migration (a new file in supabase/migrations/,
#    applied automatically on deploy by scripts/apply-migrations.sh)
# supabase/migrations/YYYYMMDDHHMMSS_create_user_events_table.sql:
#   CREATE TABLE user_events (
#     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
#     actor_id UUID NOT NULL REFERENCES actors(id),
#     title TEXT NOT NULL,
#     description TEXT,
#     start_date TIMESTAMP NOT NULL,
#     end_date TIMESTAMP NOT NULL,
#     location TEXT NOT NULL,
#     status TEXT DEFAULT 'draft',
#     created_at TIMESTAMP DEFAULT NOW()
#   );

# 5. Done! Everything else works automatically:
# - Navigation shows new entity
# - Generic CRUD handlers work
# - Forms can be generated
# - Search includes it
```

---

## Factory Pattern

### Entity Config Factory

```typescript
// Create configurations programmatically

export function createEntityConfig(type: EntityType): EntityConfig {
  const meta = ENTITY_REGISTRY[type];

  return {
    type,
    metadata: meta,
    schema: getSchemaForEntity(type),
    fields: generateFieldsForEntity(type),
    templates: getTemplatesForEntity(type),
    guidance: getGuidanceForEntity(type),
  };
}

// Usage
const productConfig = createEntityConfig('product');
const serviceConfig = createEntityConfig('service');

<EntityForm config={productConfig} />
<EntityForm config={serviceConfig} />
```

### CRUD Handler Factory

```typescript
// Generate complete CRUD handlers for any entity

export function createEntityCrudHandlers(entityType: EntityType) {
  const meta = ENTITY_REGISTRY[entityType];
  const schema = getSchemaForEntity(entityType);

  return {
    GET: compose(
      withAuth(),
      withRateLimit('read')
    )(async (request, context) => {
      const { data, error } = await context.supabase
        .from(meta.tableName)
        .select('*')
        .eq('actor_id', context.actorId);

      if (error) return apiError(error.message);
      return apiSuccess({ data });
    }),

    POST: compose(
      withAuth(),
      withRateLimit('write'),
      withValidation(schema)
    )(async (request, context) => {
      const { data, error } = await context.supabase
        .from(meta.tableName)
        .insert({
          ...context.validData,
          actor_id: context.actorId,
        })
        .select()
        .single();

      if (error) return apiError(error.message);
      return apiSuccess({ data }, 201);
    }),

    PUT: createUpdateHandler(meta, schema),
    DELETE: createDeleteHandler(meta),
  };
}

// Usage in API route
// app/api/products/route.ts
const { GET, POST, PUT, DELETE } = createEntityCrudHandlers('product');
export { GET, POST, PUT, DELETE };
```

**Benefits**:

- **DRY**: Write once, use for all entities
- **Consistency**: All entities behave identically
- **Maintainability**: Fix once, fixed everywhere
- **Velocity**: Add new entity in minutes, not hours

---

## Modularity Philosophy

### Configuration Over Code

**The Core Principle**: Don't write new components for each entity. Write configuration.

**Example**:

```typescript
// ❌ Traditional approach: New component for each entity
class ProductForm extends React.Component {
  // 500 lines of code
}

class ServiceForm extends React.Component {
  // 500 lines of code (95% duplicated!)
}

class EventForm extends React.Component {
  // 500 lines of code (95% duplicated!)
}

// ✅ Modular approach: Configuration drives behavior
const productConfig = {
  entityType: 'product',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'price_btc', type: 'number', required: true },
    { name: 'category', type: 'select', options: categories },
  ],
  validation: productSchema,
  templates: productTemplates,
};

const serviceConfig = {
  entityType: 'service',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'price_btc', type: 'number', required: true },
    { name: 'duration_minutes', type: 'number' },
  ],
  validation: serviceSchema,
  templates: serviceTemplates,
};

// One component, multiple configurations
<EntityForm config={productConfig} />
<EntityForm config={serviceConfig} />
<EntityForm config={eventConfig} />
```

### Benefits

**For Developers**:

- 37% less code
- 75% faster development
- Fix once, fix everywhere
- Easier onboarding

**For Users**:

- Consistent patterns (learn once, apply everywhere)
- Predictable behavior
- Less cognitive load
- Faster learning curve

---

## Service Layer Pattern

### Domain Services

**Purpose**: Contain business logic separate from HTTP/UI concerns

**Location**: `src/domain/[domain]/service.ts`

```typescript
// src/domain/commerce/service.ts

export class CommerceService {
  constructor(private supabase: SupabaseClient) {}

  // Business logic methods
  async createProduct(input: CreateProductInput, actorId: string) {
    // 1. Validation
    const validated = createProductSchema.parse(input);

    // 2. Business rules
    const slug = this.generateSlug(validated.title);
    const price = this.calculatePrice(validated.price_btc, validated.quantity);

    // 3. Data persistence
    const { data, error } = await this.supabase
      .from('user_products')
      .insert({ ...validated, slug, price_btc: price, actor_id: actorId })
      .select()
      .single();

    if (error) throw new BusinessError('Failed to create product', error);

    // 4. Side effects
    await this.notifyProductCreated(data);
    await this.updateSearchIndex(data);

    return data;
  }

  async calculatePrice(basePriceBtc: number, quantity: number = 1): Promise<number> {
    let price = basePriceBtc * quantity;

    // Apply bulk discount
    if (quantity >= 10) {
      price = Math.floor(price * 0.9); // 10% off
    }

    return price;
  }

  async applyPromoCode(productId: string, code: string): Promise<number> {
    // Complex promo logic
    const promo = await this.getPromoCode(code);
    if (!promo.active) throw new BusinessError('Invalid promo code');

    const product = await this.getProduct(productId);
    const discountedPrice = product.price_btc * (1 - promo.discount_percent / 100);

    return discountedPrice;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

### Usage in API Routes

**API routes are thin wrappers**:

```typescript
// app/api/products/route.ts

export async function POST(request: Request) {
  // 1. HTTP layer concerns
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError('Unauthorized', 401);

  const body = await request.json();
  const actorId = await getUserActorId(user.id);

  // 2. Delegate to domain service
  try {
    const commerce = new CommerceService(supabase);
    const product = await commerce.createProduct(body, actorId);

    // 3. HTTP response
    return apiSuccess({ data: product }, 201);
  } catch (error) {
    return handleBusinessError(error);
  }
}
```

**Benefits**:

- **Testable**: Test business logic without HTTP mocking
- **Reusable**: Use in API routes, CLI tools, background jobs
- **Maintainable**: Clear separation of concerns
- **Portable**: Easy to move to microservices if needed

---

## Composition Pattern

### Middleware Composition

**Build complex handlers from simple pieces**:

```typescript
// Small, focused middleware functions
const withAuth = () => handler => async req => {
  const user = await getUser(req);
  if (!user) return apiError('Unauthorized', 401);
  return handler(req, { user });
};

const withRateLimit = (type: 'read' | 'write') => handler => async req => {
  if (await isRateLimited(req, type)) {
    return apiError('Too many requests', 429);
  }
  return handler(req);
};

const withValidation = schema => handler => async req => {
  const body = await req.json();
  const result = schema.safeParse(body);
  if (!result.success) return apiValidationError(result.error);
  return handler(req, { validData: result.data });
};

// Compose them for complex behavior
export const POST = compose(
  withAuth(),
  withRateLimit('write'),
  withValidation(createProductSchema),
  withLogging()
)(async (req, context) => {
  // Handler has access to: user, validData
  const product = await createProduct(context.validData, context.user.id);
  return apiSuccess({ data: product });
});
```

### Component Composition

**Build UIs from small, focused components**:

```typescript
// Atomic components
<EntityForm>
  <FormHeader>
    <FormTitle />
    <FormDescription />
  </FormHeader>

  <TemplateSelector templates={templates} />

  <FormFields>
    <TextField name="title" />
    <TextArea name="description" />
    <NumberField name="price_btc" />
    <SelectField name="category" options={categories} />
  </FormFields>

  <GuidancePanel hints={hints} />

  <FormActions>
    <Button variant="outline" onClick={onCancel}>Cancel</Button>
    <Button type="submit">Create</Button>
  </FormActions>
</EntityForm>
```

---

## Progressive Disclosure Pattern

### UI Flow Design

**Show complexity incrementally**:

```
Level 1: Simple (Templates)
   ↓ User selects template
Level 2: Basic (Core fields)
   ↓ User completes basics
Level 3: Advanced (Optional fields)
   ↓ User expands if needed
Level 4: Expert (Full control)
```

### Implementation

```typescript
<Workflow>
  {/* Level 1: Simple */}
  <Step id="template" title="Choose Template">
    <TemplateGallery
      templates={templates}
      onSelect={selectTemplate}
    />
  </Step>

  {/* Level 2: Basic */}
  <Step id="basic" title="Basic Info" requires="template">
    <BasicFields fields={basicFields} />
  </Step>

  {/* Level 3: Advanced (collapsible) */}
  <Step id="advanced" title="Advanced" optional>
    <Collapsible>
      <CollapsibleTrigger>
        Show advanced options
      </CollapsibleTrigger>
      <CollapsibleContent>
        <AdvancedFields fields={advancedFields} />
      </CollapsibleContent>
    </Collapsible>
  </Step>

  {/* Level 4: Expert (hidden by default) */}
  {expertMode && (
    <Step id="expert" title="Expert Mode">
      <ExpertFields fields={allFields} />
    </Step>
  )}
</Workflow>
```

### Benefits

- **Simple for beginners**: Start with templates
- **Powerful for experts**: Access all features
- **Low cognitive load**: See only what you need now
- **Self-discovery**: Users can explore at their own pace

---

## Schema Composition Pattern

### Base Schema + Extensions

**Share common fields, extend for specifics**:

```typescript
// Base schema for ALL entities
export const baseEntitySchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional().nullable(),
  status: z.enum(['draft', 'active', 'paused', 'archived']).default('draft'),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Entity-specific extensions
export const productSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
  category: z.string().optional(),
  inventory: z.number().int().min(0).optional(),
  sku: z.string().optional(),
});

export const serviceSchema = baseEntitySchema.extend({
  price_btc: z.number().positive(),
  duration_minutes: z.number().int().positive().optional(),
  availability: z.string().optional(),
});

export const eventSchema = baseEntitySchema.extend({
  start_date: z.date(),
  end_date: z.date(),
  location: z.string().min(1),
  max_attendees: z.number().int().positive().optional(),
});
```

### Benefits

- **DRY**: Common fields defined once
- **Type Safety**: TypeScript derives types from schemas
- **Validation**: Runtime validation with Zod
- **Consistency**: All entities have same base fields
- **Evolution**: Easy to add fields to all entities

---

## Context-Aware Navigation Pattern

### Single Sidebar, Multiple Contexts

**Navigation adapts based on user context** (individual vs group):

```typescript
// Context types
type NavigationContext =
  | { type: 'individual'; userId: string }
  | { type: 'group'; groupId: string; role: string };

// Adaptive sidebar
function AdaptiveSidebar() {
  const { context } = useNavigationContext();

  // Different navigation based on context
  const navigation = context.type === 'individual'
    ? individualNavigation
    : groupNavigation;

  return (
    <Sidebar>
      <ContextSwitcher context={context} />
      <Navigation items={navigation} />
    </Sidebar>
  );
}

// Context switcher (always visible)
function ContextSwitcher({ context }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        {context.type === 'individual' ? (
          <><User /> You</>
        ) : (
          <><Building2 /> {context.name}</>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Switch between contexts */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Benefits

- **Clear context indication**: Always know where you are
- **Unified structure**: Same pattern, different content
- **No navigation bloat**: One sidebar adapts
- **Scalable**: Easy to add new context types

---

## References

- **Entity Registry**: `src/config/entity-registry.ts`
- **Factory Functions**: `src/lib/factories/`
- **Domain Services**: `src/domain/*/service.ts`
- **Middleware**: `src/lib/api/middleware.ts`
- **Modularity Philosophy**: `docs/architecture/MODULARITY_PHILOSOPHY.md`
- **Engineering Principles**: `docs/development/ENGINEERING_PRINCIPLES.md`

---

**Remember**: Architecture patterns exist to reduce complexity, not increase it. Choose the pattern that makes the system simpler to understand and maintain.
