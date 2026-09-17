# Backend & API Best Practices

**Purpose**: API design, database patterns, and backend architecture for OrangeCat

**Last Updated**: 2026-09-04

---

## API Design

### RESTful Patterns

```
GET    /api/products          # List all products
GET    /api/products/:id      # Get single product
POST   /api/products          # Create product
PUT    /api/products/:id      # Update product
DELETE /api/products/:id      # Delete product
```

### Generic Handlers (USE THESE)

```typescript
// ❌ Don't create custom route for each entity
// app/api/products/[id]/route.ts (189 lines)
// app/api/services/[id]/route.ts (189 lines - duplicated!)
// app/api/causes/[id]/route.ts (186 lines - duplicated!)

// ✅ Use generic handler factory
import { createEntityCrudHandlers } from '@/lib/api/entityHandler';

const { GET, POST, PUT, DELETE } = createEntityCrudHandlers('product');

export { GET, POST, PUT, DELETE };
```

**Benefits**:

- Write once, use for all entities
- Bug fix once, fixed everywhere
- Consistent behavior across entities
- 90% less code

---

### Middleware Composition

```typescript
import { compose } from '@/lib/api/compose';
import { withAuth, withRequestId, withRateLimit, withCache } from '@/lib/api/middleware';

// ✅ Build complex handlers from simple pieces
export const GET = compose(
  withAuth(), // Require authentication
  withRequestId(), // Add request tracking
  withRateLimit('read'), // Rate limiting (lenient for reads)
  withCache({ ttl: 60 }) // Cache for 60 seconds
)(async (request, context) => {
  // Handler logic here
  const products = await getProducts(context.user.id);
  return apiSuccess({ data: products });
});

export const POST = compose(
  withAuth(), // Require authentication
  withRequestId(), // Add request tracking
  withRateLimit('write'), // Stricter rate limit for writes
  withValidation(createProductSchema) // Validate input
)(async (request, context) => {
  const product = await createProduct(context.validData, context.user.id);
  return apiSuccess({ data: product }, 201);
});
```

**Available Middleware**:

- `withAuth()` - Require authentication
- `withRateLimit(type)` - Rate limiting ('read' | 'write')
- `withValidation(schema)` - Zod validation
- `withCache(options)` - Response caching
- `withRequestId()` - Request tracking
- `withLogging()` - Structured logging
- `withCors()` - CORS headers

---

### Response Standards

**Use standardized response helpers**:

```typescript
import { apiSuccess, apiError, apiValidationError, apiNotFound } from '@/lib/api/responses';

// ✅ Success response
return apiSuccess({
  data: product,
  meta: { total: 100, page: 1 },
});
// Returns: { success: true, data: {...}, meta: {...} }

// ✅ Error response
return apiError('Product not found', 404);
// Returns: { success: false, error: 'Product not found' } with 404 status

// ✅ Validation error
return apiValidationError(zodError);
// Returns: { success: false, errors: [{field: 'title', message: '...'}] }

// ✅ Not found (shorthand)
return apiNotFound('Product');
// Returns: { success: false, error: 'Product not found' } with 404 status

// ❌ Don't return raw responses
return new Response(JSON.stringify({ data })); // Inconsistent!
```

---

## Database Patterns (Supabase)

### Client Creation

```typescript
// ✅ Always use server-side client
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createServerClient();
  // Use supabase client...
}

// ❌ Don't use browser client in API routes
import { createClient } from '@supabase/supabase-js'; // Wrong!
```

### Direct DB Access (Self-Hosted Supabase)

The Supabase MCP is retired (it only spoke to the retired managed-cloud project).
Talk to the self-host directly:

```bash
# Read any table via PostgREST (keys in .env.local; service-role bypasses RLS)
curl -s -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
     -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/user_products?select=id,title&limit=5"

# Schema changes: write a migration file and merge it — it applies on deploy
# supabase/migrations/YYYYMMDDHHMMSS_add_warranty_field.sql:
#   ALTER TABLE user_products ADD COLUMN warranty_period INTEGER;

# DDL inspection / anything PostgREST cannot express: via the box
ssh ubuntu@167.233.22.31 \
  'docker exec supabase-db psql -U postgres -d postgres -c "\d+ user_products"'
```

---

### RLS (Row Level Security)

**CRITICAL**: Always rely on RLS, never implement auth in application code

```typescript
// ❌ Don't check ownership in application code
const { data: product } = await supabase.from('user_products').select('*').eq('id', id).single();

if (product.actor_id !== userActorId) {
  return apiError('Unauthorized', 403); // Wrong approach!
}

// ✅ Let RLS handle it automatically
const { data: product, error } = await supabase
  .from('user_products')
  .select('*')
  .eq('id', id)
  .single();

// RLS policy ensures user can only see their own products
// If not authorized, supabase returns null (handled by RLS)
if (error) {
  return apiNotFound('Product');
}
```

**Why RLS is better**:

- Security enforced at database level
- Can't be bypassed by application bugs
- Applies to all queries automatically
- Consistent across all clients

**RLS Policy Example**:

```sql
-- Migration: Enable RLS
ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own products
CREATE POLICY "Users can view own products"
  ON user_products
  FOR SELECT
  USING (actor_id IN (
    SELECT id FROM actors WHERE user_id = auth.uid()
  ));

-- Policy: Users can create products for their actor
CREATE POLICY "Users can create own products"
  ON user_products
  FOR INSERT
  WITH CHECK (actor_id IN (
    SELECT id FROM actors WHERE user_id = auth.uid()
  ));
```

---

### Query Patterns

#### Select Specific Columns

```typescript
// ✅ Select only needed columns
const { data } = await supabase
  .from('user_products')
  .select('id, title, price_btc, status, created_at')
  .eq('id', id)
  .single();

// ❌ Don't select everything if not needed
const { data } = await supabase
  .from('user_products')
  .select('*') // Wasteful if you only need a few fields
  .eq('id', id)
  .single();
```

#### Use Joins for Relationships

```typescript
// ✅ Join related tables
const { data } = await supabase
  .from('user_products')
  .select(
    `
    *,
    actor:actors(
      id,
      username,
      avatar_url
    ),
    category:categories(
      id,
      name
    )
  `
  )
  .eq('id', id)
  .single();

// Result includes nested objects
// data.actor.username
// data.category.name
```

#### Pagination

```typescript
// ✅ Proper pagination with count
const page = 1;
const pageSize = 20;
const start = (page - 1) * pageSize;
const end = start + pageSize - 1;

const { data, count, error } = await supabase
  .from('user_products')
  .select('*', { count: 'exact' })
  .range(start, end)
  .order('created_at', { ascending: false });

// Return with pagination metadata
return apiSuccess({
  data,
  meta: {
    total: count,
    page,
    pageSize,
    totalPages: Math.ceil(count / pageSize),
  },
});
```

#### Prevent N+1 Queries

```typescript
// ❌ N+1 query problem
const products = await getProducts();
for (const product of products) {
  // Each iteration makes a query - BAD!
  const actor = await supabase.from('actors').select('*').eq('id', product.actor_id).single();
  product.actor = actor.data;
}

// ✅ Single query with join
const { data: products } = await supabase.from('user_products').select(`
    *,
    actor:actors(*)
  `);
// All data fetched in one query
```

---

## Validation

### Zod Schemas (ALWAYS Use)

```typescript
import { z } from 'zod';

// ✅ Define schema with constraints
export const createProductSchema = baseEntitySchema.extend({
  price_btc: z.number().positive('Price must be positive'),
  category: z.string().min(1, 'Category required').optional(),
  inventory: z.number().int().min(0, 'Inventory cannot be negative').optional(),
});

// ✅ Use in API route
export async function POST(request: Request) {
  const body = await request.json();
  const result = createProductSchema.safeParse(body);

  if (!result.success) {
    return apiValidationError(result.error);
  }

  // Now data is validated and typed
  const validData: CreateProductInput = result.data;
  const product = await createProduct(validData);

  return apiSuccess({ data: product }, 201);
}
```

### Input Sanitization

```typescript
// ✅ Always sanitize user input (especially HTML)
import DOMPurify from 'isomorphic-dompurify';

const sanitizedDescription = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p'],
  ALLOWED_ATTR: ['href'],
});
```

---

## Error Handling

### Structured Error Handling

```typescript
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();

  try {
    const body = await request.json();

    // Validation
    const result = schema.safeParse(body);
    if (!result.success) {
      return apiValidationError(result.error);
    }

    // Business logic
    const product = await createProduct(result.data);

    return apiSuccess({ data: product }, 201);
  } catch (error) {
    // Log error with context
    console.error('[API Error]', {
      endpoint: '/api/products',
      method: 'POST',
      requestId,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Handle specific error types
    if (error instanceof ZodError) {
      return apiValidationError(error);
    }

    if (error.code === 'PGRST116') {
      return apiNotFound('Resource');
    }

    if (error.code === '23505') {
      return apiError('Duplicate entry', 409);
    }

    // Generic error (don't expose details to client)
    return apiError('Internal server error', 500);
  }
}
```

### Logging

```typescript
// ✅ Structured logging with context
console.log('[API]', {
  endpoint: '/api/products',
  method: 'POST',
  userId: user.id,
  requestId,
  duration: Date.now() - startTime,
  status: 'success',
});

// ✅ Error logging with details
console.error('[API Error]', {
  endpoint: '/api/products',
  method: 'POST',
  userId: user?.id,
  requestId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
});

// ❌ Don't log generic messages
console.log('Success'); // Not helpful!
console.error('Error'); // Not helpful!
```

---

## Security

### Authentication

```typescript
// ✅ Check authentication with Supabase
const supabase = createServerClient();
const {
  data: { user },
  error,
} = await supabase.auth.getUser();

if (!user) {
  return apiError('Unauthorized', 401);
}

// Now you have authenticated user
const userActorId = await getUserActorId(user.id);
```

### Rate Limiting

```typescript
// ✅ Apply rate limits based on operation type
export const GET = compose(
  withAuth(),
  withRateLimit('read') // 100 requests/minute
)(handler);

export const POST = compose(
  withAuth(),
  withRateLimit('write') // 20 requests/minute (stricter)
)(handler);
```

### CORS

```typescript
// ✅ Set CORS headers appropriately
export async function GET() {
  const data = await getData();

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

### Environment Variables

**CRITICAL**: Never expose secrets to client

```typescript
// ✅ Server-side only (no NEXT_PUBLIC_ prefix)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ✅ Client-safe (NEXT_PUBLIC_ prefix)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// ❌ Don't use service role key on client
// process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY  // WRONG!
```

**Environment File** (`.env.local`):

```bash
# Public (safe to expose to browser)
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Private (server-only)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

# Never commit .env.local to git!
```

---

## Performance

### Caching Strategy

```typescript
// ✅ Cache GET requests
export const GET = compose(
  withCache({
    ttl: 60, // Cache for 60 seconds
    key: req => `products-${req.url}`, // Cache key
    vary: ['Authorization'], // Vary by auth
  })
)(async request => {
  const products = await getProducts();
  return apiSuccess({ data: products });
});

// ✅ Invalidate cache on mutation
export const POST = compose(withCacheInvalidation(['products-*']))(async request => {
  const product = await createProduct(data);
  // Cache automatically invalidated
  return apiSuccess({ data: product }, 201);
});
```

### Database Indexing

```sql
-- ✅ Index frequently queried columns
CREATE INDEX idx_user_products_actor_id ON user_products(actor_id);
CREATE INDEX idx_user_products_status ON user_products(status);
CREATE INDEX idx_user_products_created_at ON user_products(created_at DESC);

-- ✅ Composite index for common queries
CREATE INDEX idx_user_products_actor_status
  ON user_products(actor_id, status);

```

### Query Optimization

```typescript
// ✅ Use database functions for complex logic
const { data } = await supabase.rpc('get_user_products_with_stats', {
  user_actor_id: actorId,
});

// Database function (faster than app-level logic):
// CREATE FUNCTION get_user_products_with_stats(user_actor_id UUID)
// RETURNS TABLE(...) AS $$
//   SELECT p.*, COUNT(o.id) as order_count
//   FROM user_products p
//   LEFT JOIN orders o ON o.product_id = p.id
//   WHERE p.actor_id = user_actor_id
//   GROUP BY p.id;
// $$ LANGUAGE SQL;
```

---

## Service Layer Pattern

### Domain Services

```typescript
// ✅ Domain service with business logic
// src/domain/commerce/service.ts

export class CommerceService {
  constructor(private supabase: SupabaseClient) {}

  async createProduct(input: CreateProductInput, actorId: string) {
    // Validation
    const schema = createProductSchema.parse(input);

    // Business logic
    const slug = this.generateSlug(schema.title);

    // Database operation
    const { data, error } = await this.supabase
      .from('user_products')
      .insert({
        ...schema,
        actor_id: actorId,
        slug,
      })
      .select()
      .single();

    if (error) throw error;

    // Post-processing
    await this.notifyNewProduct(data);

    return data;
  }

  async calculateProductPrice(product: Product, quantity: number) {
    // Complex pricing logic
    let price = product.price_btc * quantity;

    // Apply bulk discount
    if (quantity >= 10) {
      price *= 0.9; // 10% discount
    }

    return Math.floor(price);
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async notifyNewProduct(product: Product) {
    // Send notifications, update indexes, etc.
  }
}
```

### Usage in API Routes

```typescript
// ✅ API route is thin wrapper
// app/api/products/route.ts

export async function POST(request: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return apiError('Unauthorized', 401);

  const body = await request.json();
  const actorId = await getUserActorId(user.id);

  // Delegate to domain service
  const commerce = new CommerceService(supabase);
  const product = await commerce.createProduct(body, actorId);

  return apiSuccess({ data: product }, 201);
}
```

**Benefits**:

- Business logic separate from HTTP concerns
- Testable without HTTP mocking
- Reusable across different entry points
- Clear responsibility boundaries

---

## Testing

### API Route Tests

```typescript
// __tests__/api/products.test.ts

describe('POST /api/products', () => {
  it('creates product with valid data', async () => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${testToken}`,
      },
      body: JSON.stringify({
        title: 'Test Product',
        price_btc: 0.001,
        description: 'Test description',
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('Test Product');
  });

  it('rejects invalid data', async () => {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '', // Invalid: empty title
        price_btc: -0.001, // Invalid: negative price
      }),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.errors).toHaveLength(2);
  });

  it('requires authentication', async () => {
    const response = await fetch('/api/products', {
      method: 'POST',
      // No Authorization header
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(response.status).toBe(401);
  });
});
```

### Service Tests

```typescript
// __tests__/domain/commerce.test.ts

describe('CommerceService', () => {
  let service: CommerceService;
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    service = new CommerceService(mockSupabase);
  });

  it('calculates bulk discount correctly', () => {
    const product = { price_btc: 0.00001 };

    // No discount for small quantity
    expect(service.calculateProductPrice(product, 5)).toBeCloseTo(0.00005);

    // 10% discount for bulk
    expect(service.calculateProductPrice(product, 10)).toBeCloseTo(0.00009);
  });
});
```

---

## OrangeCat-Specific Patterns

### Actor System

**Everything is owned by an Actor**:

```typescript
// ✅ Query by actor
const { data: products } = await supabase.from('user_products').select('*').eq('actor_id', actorId);

// Users have actors
const userActor = await getUserActor(userId);

// Groups have actors
const groupActor = await getGroupActor(groupId);
```

### Bitcoin Integration

```typescript
// ✅ Always store in BTC using NUMERIC(18,8)
const price_btc = 0.001; // stored as 0.00100000

// ✅ Display with formatting via hook
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
const { formatAmount } = useDisplayCurrency();
formatAmount(0.001); // "0.001 BTC" or "CHF 86.00" depending on user pref
```

### Remote-Only Supabase

**CRITICAL**: No local Supabase instance

```typescript
// ✅ All credentials from .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// ✅ Reads go through PostgREST at supabase.orangecat.ch;
// ✅ schema changes are files in supabase/migrations/ applied on deploy

// ❌ Don't try to use local Supabase
// pnpm exec supabase start  // Won't work!
```

---

## References

- **API Utilities**: `src/lib/api/`
- **Supabase Client**: `src/lib/supabase/server.ts`
- **Validation Schemas**: `src/lib/validation.ts`
- **Entity Registry**: `src/config/entity-registry.ts`
- **Engineering Principles**: `docs/development/ENGINEERING_PRINCIPLES.md`
- **Remote Supabase Setup**: `docs/operations/REMOTE_ONLY_SUPABASE.md`

---

**Remember**: API routes should be thin. Business logic lives in domain services. Security is enforced by RLS.
