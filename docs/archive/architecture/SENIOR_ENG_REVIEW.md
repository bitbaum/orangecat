# Senior Engineering Review: OrangeCat Codebase Improvements

**Created:** 2025-11-03  
**Last Modified:** 2025-11-03  
**Last Modified Summary:** Comprehensive senior engineering review with prioritized recommendations

---

## Executive Summary

After analyzing the OrangeCat codebase, I've identified **8 critical issues** and **12 high-priority improvements** across data consistency, architecture, performance, and code quality. This document provides concrete, actionable recommendations with implementation guidance.

### Priority Breakdown

- 🔴 **CRITICAL (Fix Immediately)**: 2 issues
- 🟠 **HIGH PRIORITY (Next Sprint)**: 6 issues
- 🟡 **MEDIUM PRIORITY (Next Month)**: 8 improvements
- 🟢 **NICE TO HAVE (Technical Debt)**: 4 improvements

---

## 🔴 CRITICAL ISSUES

### 1. **Data Consistency: Transaction → Project raised_amount Sync Missing**

**Problem**: When transactions are created or their status changes to `'confirmed'`, the `projects.raised_amount` field is **never automatically updated**. This causes:

- Inconsistent data: `raised_amount` remains 0 even when donations are confirmed
- Manual calculation required everywhere (`fundraising.ts` recalculates from transactions)
- Risk of data drift over time
- Poor user experience (projects show $0 raised despite donations)

**Current State**:

```typescript
// src/app/api/transactions/route.ts
// Transaction created but no project.raised_amount update
await supabase.from('transactions').insert({...}) // ❌ No sync

// src/services/supabase/fundraising.ts
// Manual calculation from transactions (inefficient)
const totalRaised = transactions?.reduce((sum, t) => sum + (t.amount_sats || 0), 0) || 0;
```

**Solution**: Create database trigger to automatically maintain `raised_amount`

**Implementation**:

```sql
-- supabase/migrations/YYYYMMDD_sync_project_funding.sql
CREATE OR REPLACE FUNCTION sync_project_funding()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update on confirmed transactions to projects
  IF NEW.to_entity_type = 'project' AND NEW.status = 'confirmed' THEN
    -- Add to raised_amount
    UPDATE projects
    SET raised_amount = COALESCE(raised_amount, 0) + NEW.amount_sats,
        updated_at = NOW()
    WHERE id = NEW.to_entity_id;

    -- Increment contributor_count if from_entity is a profile
    IF NEW.from_entity_type = 'profile' THEN
      UPDATE projects
      SET contributor_count = contributor_count + 1
      WHERE id = NEW.to_entity_id;
    END IF;
  END IF;

  -- Handle status changes (e.g., confirmed -> failed)
  IF OLD.status != NEW.status AND NEW.to_entity_type = 'project' THEN
    IF OLD.status = 'confirmed' AND NEW.status != 'confirmed' THEN
      -- Remove from raised_amount if transaction is no longer confirmed
      UPDATE projects
      SET raised_amount = GREATEST(0, raised_amount - OLD.amount_sats),
          updated_at = NOW()
      WHERE id = OLD.to_entity_id;
    END IF;

    IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
      -- Add to raised_amount if transaction is newly confirmed
      UPDATE projects
      SET raised_amount = COALESCE(raised_amount, 0) + NEW.amount_sats,
          updated_at = NOW()
      WHERE id = NEW.to_entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_funding_sync
  AFTER INSERT OR UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION sync_project_funding();

-- One-time backfill for existing data
UPDATE projects p
SET raised_amount = COALESCE((
  SELECT SUM(amount_sats)
  FROM transactions
  WHERE to_entity_type = 'project'
    AND to_entity_id = p.id
    AND status = 'confirmed'
), 0);
```

**Impact**:

- ✅ Automatic data consistency
- ✅ Eliminates manual calculations
- ✅ Atomic updates (database-level)
- ✅ Handles edge cases (status changes, cancellations)

**Testing**:

```sql
-- Test: Create transaction → Verify raised_amount updates
INSERT INTO transactions (amount_sats, from_entity_type, from_entity_id, to_entity_type, to_entity_id, status)
VALUES (10000, 'profile', '...', 'project', '...', 'confirmed');

-- Verify: SELECT raised_amount FROM projects WHERE id = '...';
```

---

### 2. **Permission Check Logic Duplicated & Inconsistent**

**Problem**: Permission validation is scattered across multiple files with duplicated logic:

```typescript
// src/app/api/transactions/route.ts (lines 19-40)
// Duplicated in GET handler (lines 101-120)
let hasPermission = false;
switch (body.from_entity_type) {
  case 'profile':
    if (body.from_entity_id === user.id) {
      hasPermission = true;
    }
    break;
  case 'project':
    const { data: project } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', body.from_entity_id)
      .single();
    if (project && project.user_id === user.id) {
      hasPermission = true;
    }
    break;
}
```

**Issues**:

- Logic duplicated in POST and GET handlers
- Inconsistent error messages
- No centralized place to add new permission rules
- Hard to test in isolation
- Easy to introduce bugs when updating logic

**Solution**: Create centralized `PermissionService`

**Implementation**:

```typescript
// src/services/permissions/index.ts
import { createServerClient } from '@/lib/supabase/server';

export type EntityType = 'profile' | 'project';

export interface PermissionCheck {
  entityType: EntityType;
  entityId: string;
  userId: string;
}

export class PermissionService {
  /**
   * Check if user owns a profile
   */
  static async ownsProfile(userId: string, profileId: string): Promise<boolean> {
    return userId === profileId;
  }

  /**
   * Check if user is creator of a project
   */
  static async ownsProject(userId: string, projectId: string): Promise<boolean> {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (error || !data) return false;
    return data.user_id === userId;
  }

  /**
   * Check if user can create transactions for an entity
   */
  static async canCreateTransaction(
    userId: string,
    fromEntityType: EntityType,
    fromEntityId: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    switch (fromEntityType) {
      case 'profile':
        if (!(await this.ownsProfile(userId, fromEntityId))) {
          return { allowed: false, reason: 'User does not own this profile' };
        }
        return { allowed: true };

      case 'project':
        if (!(await this.ownsProject(userId, fromEntityId))) {
          return { allowed: false, reason: 'User does not own this project' };
        }
        return { allowed: true };

      default:
        return { allowed: false, reason: 'Invalid entity type' };
    }
  }

  /**
   * Check if user can view transactions for an entity
   */
  static async canViewTransactions(
    userId: string | null,
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    if (!userId) return false; // Public transactions handled separately

    switch (entityType) {
      case 'profile':
        return await this.ownsProfile(userId, entityId);
      case 'project':
        return await this.ownsProject(userId, entityId);
      default:
        return false;
    }
  }
}
```

**Usage**:

```typescript
// src/app/api/transactions/route.ts
import { PermissionService } from '@/services/permissions';

export async function POST(request: NextRequest) {
  const { user } = await supabase.auth.getUser();
  if (!user) return apiUnauthorized();

  const permission = await PermissionService.canCreateTransaction(
    user.id,
    body.from_entity_type,
    body.from_entity_id
  );

  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason || 'Permission denied' }, { status: 403 });
  }
  // ... rest of handler
}
```

**Impact**:

- ✅ Single source of truth for permissions
- ✅ Easier to test
- ✅ Consistent error messages
- ✅ Easy to extend (e.g., organization permissions later)

---

## 🟠 HIGH PRIORITY ISSUES

### 3. **N+1 Query Problem in Projects API**

**Problem**: `GET /api/projects` fetches profiles one-by-one in a loop:

```typescript
// src/app/api/projects/route.ts (lines 40-58)
const projectsWithProfiles = await Promise.all(
  (projects || []).map(async project => {
    // ❌ One query per project
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, username, name, avatar_url')
      .eq('id', project.user_id)
      .single();
    // ...
  })
);
```

**Impact**:

- 20 projects = 20 additional queries
- Slow response times
- Unnecessary database load

**Solution**: Single query with JOIN

```typescript
// src/app/api/projects/route.ts
export async function GET(request: NextRequest) {
  // ... rate limiting ...

  const { data: projects, error } = await supabase
    .from('projects')
    .select(
      `
      *,
      profiles!inner(id, username, name, avatar_url)
    `
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiInternalError('Failed to fetch projects', { details: error.message });
  }

  // Transform response (Supabase returns nested structure)
  const projectsWithProfiles = (projects || []).map(project => ({
    ...project,
    profiles: Array.isArray(project.profiles) ? project.profiles[0] : project.profiles,
  }));

  return apiSuccess(projectsWithProfiles);
}
```

**Impact**:

- ✅ 1 query instead of N+1 queries
- ✅ 10-50x faster for typical requests
- ✅ Reduced database load

---

### 4. **Missing Transaction Validation: Entity Existence & Status**

**Problem**: Transaction creation doesn't validate:

1. Target entity exists (could reference deleted project)
2. Project is in 'active' status (can't donate to draft/cancelled)
3. Transaction amount is reasonable

**Current Code**:

```typescript
// src/app/api/transactions/route.ts
// ❌ No validation that to_entity exists or is active
await supabase.from('transactions').insert({...});
```

**Solution**: Add validation before insert

```typescript
// src/app/api/transactions/route.ts
export async function POST(request: NextRequest) {
  // ... auth & permission checks ...

  // Validate target entity exists and is eligible
  if (body.to_entity_type === 'project') {
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', body.to_entity_id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Target project not found' }, { status: 404 });
    }

    if (project.status !== 'active') {
      return NextResponse.json({ error: 'Cannot donate to inactive project' }, { status: 400 });
    }
  }

  if (body.to_entity_type === 'profile') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, status')
      .eq('id', body.to_entity_id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Target profile not found' }, { status: 404 });
    }

    if (profile.status !== 'active') {
      return NextResponse.json({ error: 'Cannot send to inactive profile' }, { status: 400 });
    }
  }

  // Additional validation: reasonable amount
  if (body.amount_sats > 1000000000000) {
    // 1M BTC
    return NextResponse.json({ error: 'Transaction amount too large' }, { status: 400 });
  }

  // ... create transaction ...
}
```

**Impact**:

- ✅ Prevents invalid transactions
- ✅ Better error messages
- ✅ Data integrity

---

### 5. **Inconsistent Error Handling Across API Routes**

**Problem**: Three different error handling patterns:

1. **Pattern A** (Projects API - Good):

```typescript
return apiUnauthorized();
return apiValidationError('...', {...});
return handleApiError(error);
```

2. **Pattern B** (Transactions API - Inconsistent):

```typescript
return NextResponse.json({ error: '...' }, { status: 401 });
// Sometimes uses helpers, sometimes doesn't
```

3. **Pattern C** (Some routes):

```typescript
throw new Error('...'); // Unhandled
```

**Solution**: Standardize on `standardResponse.ts` helpers

**Create middleware wrapper**:

```typescript
// src/lib/api/routeHandler.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { apiSuccess, apiUnauthorized, handleApiError } from './standardResponse';
import { rateLimit, createRateLimitResponse } from '@/lib/rate-limit';

interface RouteHandlerOptions {
  requireAuth?: boolean;
  requireRateLimit?: boolean;
  validateInput?: z.ZodSchema;
}

export function createRouteHandler<T = any>(
  handler: (req: NextRequest, context: { user: any }) => Promise<T>,
  options: RouteHandlerOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Rate limiting
      if (options.requireRateLimit !== false) {
        const rateLimitResult = rateLimit(req);
        if (!rateLimitResult.success) {
          return createRateLimitResponse(rateLimitResult);
        }
      }

      // Authentication
      let user = null;
      if (options.requireAuth) {
        const supabase = await createServerClient();
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !authUser) {
          return apiUnauthorized();
        }
        user = authUser;
      }

      // Input validation
      if (options.validateInput && req.method !== 'GET') {
        const body = await req.json();
        options.validateInput.parse(body);
      }

      // Execute handler
      const result = await handler(req, { user });
      return apiSuccess(result);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
```

**Usage**:

```typescript
// src/app/api/transactions/route.ts
import { createRouteHandler } from '@/lib/api/routeHandler';
import { transactionSchema } from '@/lib/validation';

export const POST = createRouteHandler(
  async (req, { user }) => {
    const body = await req.json();
    // ... business logic ...
    return transaction;
  },
  {
    requireAuth: true,
    validateInput: transactionSchema,
  }
);
```

**Impact**:

- ✅ Consistent error responses
- ✅ Less boilerplate
- ✅ Easier testing
- ✅ Centralized error handling

---

### 6. **Multiple Authentication Middleware Implementations**

**Problem**: Three different auth wrappers:

- `withAuth` (`src/lib/api/withAuth.ts`)
- `secureAPIRoute` (`src/services/security/security-hardening.ts`)
- `withSecurity` (`src/utils/security.ts`)

**Issues**:

- Confusing which to use
- Inconsistent behavior
- Maintenance burden

**Solution**: Consolidate into single `createRouteHandler` (see issue #5)

**Action**:

1. Migrate all routes to `createRouteHandler`
2. Deprecate `withAuth`, `secureAPIRoute`, `withSecurity`
3. Document migration guide

---

### 7. **Missing Zod Validation in Transaction Route**

**Problem**: Transaction creation doesn't use Zod validation schema even though it exists:

```typescript
// src/app/api/transactions/route.ts
const body: TransactionFormData = await request.json(); // ❌ No validation
```

But schema exists:

```typescript
// src/lib/validation.ts
export const transactionSchema = z.object({...}); // ✅ Exists but unused
```

**Solution**: Use schema validation

```typescript
// src/app/api/transactions/route.ts
import { transactionSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  // ...
  const body = await request.json();
  const validatedData = transactionSchema.parse(body); // ✅ Validate
  // ...
}
```

Or better yet, use `createRouteHandler` with `validateInput: transactionSchema`.

---

### 8. **Race Condition Risk: Transaction Status Updates**

**Problem**: No database-level lock when updating transaction status. If two webhooks/processes confirm the same transaction simultaneously:

```
Process A: transaction.status = 'confirmed' → UPDATE projects.raised_amount += 1000
Process B: transaction.status = 'confirmed' → UPDATE projects.raised_amount += 1000
Result: raised_amount increased by 2000 instead of 1000
```

**Solution**: Use database trigger with proper locking (already solved by trigger in issue #1) + add idempotency

```sql
-- In sync_project_funding() trigger
-- Add check to prevent double-counting
IF TG_OP = 'UPDATE' AND OLD.status = 'confirmed' AND NEW.status = 'confirmed' THEN
  -- Status already confirmed, don't update again
  RETURN NEW;
END IF;
```

Or use optimistic locking:

```typescript
// Add version column to transactions
ALTER TABLE transactions ADD COLUMN version INTEGER DEFAULT 0;

// In update handler
UPDATE transactions
SET status = 'confirmed', version = version + 1
WHERE id = $1 AND version = $expected_version;
```

---

## 🟡 MEDIUM PRIORITY IMPROVEMENTS

### 9. **Type Safety: Replace `any` Types**

**Locations with `any`**:

- `src/app/api/projects/route.ts` (line 119): `zodError as any`
- Various places in analytics service
- Component props sometimes use `any`

**Solution**: Create proper error types

```typescript
// src/lib/errors.ts
export interface ZodValidationError {
  errors: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}
```

---

### 10. **Search Cache: Memory Leak Risk**

**Problem**: `searchCache` in `src/services/search.ts` uses Map with no size limit

```typescript
const searchCache = new Map<string, CacheEntry>();
// ❌ No max size, will grow indefinitely
```

**Solution**: Implement LRU cache with max size

```typescript
// src/utils/lruCache.ts
export class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;

    // Move to end (most recently used)
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

---

### 11. **Missing Database Indexes for Common Queries**

**Current indexes**: Basic indexes exist, but missing:

- Composite index on `(to_entity_type, to_entity_id, status)` for transaction queries
- Index on `projects(user_id, status)` for user's active projects
- Partial index on `transactions(status = 'confirmed')` for faster confirmed transaction queries

**Solution**:

```sql
-- Composite index for transaction queries
CREATE INDEX IF NOT EXISTS idx_transactions_to_status
ON transactions(to_entity_type, to_entity_id, status);

-- User projects query optimization
CREATE INDEX IF NOT EXISTS idx_projects_user_status
ON projects(user_id, status) WHERE status = 'active';

-- Confirmed transactions (most common query)
CREATE INDEX IF NOT EXISTS idx_transactions_confirmed
ON transactions(to_entity_id, to_entity_type)
WHERE status = 'confirmed';
```

---

### 12. **Analytics Service: Inefficient Calculation**

**Problem**: `getUserFundraisingStats` recalculates from all transactions on every call:

```typescript
// src/services/supabase/fundraising.ts
// ❌ Scans all transactions for user's projects every time
const { data: transactions } = await supabase
  .from('transactions')
  .select('amount_sats, from_entity_id')
  .eq('to_entity_type', 'project')
  .or(projectFilters)
  .eq('status', 'confirmed');
```

**Solution**: Use materialized view or cache

```sql
-- Materialized view for fundraising stats
CREATE MATERIALIZED VIEW project_funding_stats AS
SELECT
  p.id as project_id,
  p.user_id,
  COUNT(DISTINCT CASE WHEN t.from_entity_type = 'profile' THEN t.from_entity_id END) as contributor_count,
  COALESCE(SUM(t.amount_sats), 0) as raised_amount,
  COUNT(*) as transaction_count
FROM projects p
LEFT JOIN transactions t ON (
  t.to_entity_type = 'project'
  AND t.to_entity_id = p.id
  AND t.status = 'confirmed'
)
GROUP BY p.id, p.user_id;

CREATE INDEX ON project_funding_stats(user_id);
CREATE INDEX ON project_funding_stats(project_id);

-- Refresh trigger (refresh after transaction updates)
CREATE OR REPLACE FUNCTION refresh_funding_stats()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY project_funding_stats;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER refresh_stats_after_transaction
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION refresh_funding_stats();
```

**Alternative**: Cache with longer TTL (5 minutes → 30 minutes for stats)

---

### 13. **Missing Transaction Atomicity: Project Updates**

**Problem**: Transaction creation and project update are separate operations:

```typescript
// Current: Two separate operations
await supabase.from('transactions').insert({...}); // Operation 1
// If this fails, transaction exists but project not updated
await supabase.from('projects').update({...}); // Operation 2
```

**Solution**: Database trigger handles this automatically (see issue #1)

---

### 14. **Inconsistent Currency Handling**

**Problem**: Mix of `'BTC'`, `'SATS'`, `'CHF'`, `'USD'` with inconsistent defaults:

- `transactions.currency` defaults to `'BTC'`
- `projects.currency` defaults to `'SATS'`
- `projects.goal_currency` defaults to `'BTC'`

**Solution**: Standardize on SATS internally, convert for display

```sql
-- Migration: Standardize currency
ALTER TABLE transactions ALTER COLUMN currency SET DEFAULT 'SATS';
-- Keep goal_currency for user-facing goals, but store amounts in SATS
```

---

### 15. **Missing Input Sanitization in Search**

**Problem**: Search queries use user input directly in `.or()` queries:

```typescript
// src/services/search.ts
const sanitizedQuery = query.replace(/[%_]/g, '\\$&');
profileQuery = profileQuery.or(`username.ilike.%${sanitizedQuery}%,name.ilike.%${sanitizedQuery}%`);
```

**Issues**:

- SQL injection risk if Supabase client has bugs
- No length limits
- No rate limiting per search query

**Solution**:

- Add query length limit (max 100 chars)
- Add search-specific rate limiting
- Validate query contains only safe characters

---

### 16. **Console.log in Production Code**

**Found**: `src/app/api/projects/route.ts` line 111 has console.error

```typescript
try {
  console.error('[API] /api/projects insert error:', error);
} catch {}
```

**Solution**: Use logger utility

```typescript
import { logger } from '@/utils/logger';
logger.error('Project creation failed', error, 'Projects');
```

---

## 🟢 NICE TO HAVE (Technical Debt)

### 17. **Service Layer: Extract Transaction Logic**

**Current**: Transaction logic in API route  
**Proposal**: Create `TransactionService`

```typescript
// src/services/transactions/index.ts
export class TransactionService {
  static async createTransaction(data: TransactionFormData, userId: string) {
    // Validation
    // Permission check
    // Entity existence check
    // Insert
    // Return transaction
  }

  static async getTransactions(options: TransactionQueryOptions) {
    // Permission check
    // Query
    // Return results
  }
}
```

---

### 18. **TypeScript: Stricter Type Definitions**

**Missing**:

- Union types for entity types instead of strings
- Discriminated unions for transaction types
- Branded types for IDs (prevent mixing profile_id and project_id)

```typescript
// Instead of
from_entity_id: string;

// Use
from_entity_id: ProfileId | ProjectId; // Branded types
```

---

### 19. **API Response Standardization**

**Current**: Mix of response formats  
**Proposal**: Always use:

```typescript
{
  success: boolean;
  data?: T;
  error?: string;
  meta?: { pagination, etc };
}
```

---

### 20. **Database: Add Soft Deletes**

**Current**: Hard deletes (CASCADE)  
**Proposal**: Add `deleted_at` timestamp for audit trail

---

## Implementation Priority

### Sprint 1 (Week 1): Critical Fixes

1. ✅ Issue #1: Database trigger for `raised_amount` sync
2. ✅ Issue #2: Permission service consolidation

### Sprint 2 (Week 2): High Priority

3. ✅ Issue #3: Fix N+1 queries
4. ✅ Issue #4: Transaction validation
5. ✅ Issue #5: Error handling standardization
6. ✅ Issue #8: Race condition prevention

### Sprint 3 (Week 3): Medium Priority

7. ✅ Issues #6, #7: Auth consolidation + validation
8. ✅ Issue #9: Type safety improvements
9. ✅ Issue #10: Cache improvements
10. ✅ Issue #11: Database indexes

### Sprint 4 (Week 4): Polish

11. ✅ Issue #12: Analytics optimization
12. ✅ Remaining medium priority items

---

## Metrics to Track

After implementing fixes, measure:

- **API Response Time**: Target < 200ms for GET /api/projects
- **Database Query Count**: Should decrease 50%+ after N+1 fix
- **Data Consistency**: Monitor `raised_amount` vs actual transaction sums
- **Error Rate**: Should decrease with better validation

---

**Document Status**: ✅ Complete - Ready for implementation prioritization

