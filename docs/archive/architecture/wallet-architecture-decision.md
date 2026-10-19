# Wallet Architecture Decision

**Date:** 2025-02-01
**Status:** ✅ Recommended
**Decision:** Migrate to `wallets` table exclusively, remove metadata fallback

---

## Current State (Problem)

### Dual Storage System

The application currently has **two parallel wallet storage mechanisms**:

1. **Modern:** `wallets` table (PostgreSQL)
   - Normalized schema
   - Full feature support (categories, goals, xpub)
   - RLS policies
   - Supports both profile and project wallets

2. **Legacy:** `profiles.metadata` JSONB fallback
   - Used when `wallets` table doesn't exist
   - Limited features
   - No type safety
   - Complexity in API layer

### Code Evidence

**File:** `src/app/api/wallets/route.ts`

```typescript
// Lines 29-41: Fallback mechanism
const FALLBACK_WALLETS_KEY = 'wallets';

async function getFallbackProfileWallets(supabase, profileId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('metadata')
    .eq('id', profileId)
    .single();

  const metadata = profile?.metadata || {};
  return metadata[FALLBACK_WALLETS_KEY] || [];
}
```

### Issues

1. **Code Complexity:** API routes check table existence, fall back to metadata
2. **Feature Inconsistency:** Metadata storage doesn't support full wallet features
3. **Type Safety:** JSONB is untyped, can store anything
4. **Performance:** Extra queries to check table existence
5. **Migration Confusion:** Unclear if migration is complete or ongoing

---

## Recommendation: Complete Migration to Wallets Table

### Option A: Remove Fallback (Recommended)

**Action:** Delete all metadata fallback code, use `wallets` table exclusively.

#### Implementation Steps:

1. **Verify Migration Complete**

   ```sql
   -- Check if wallets table exists
   SELECT EXISTS (
     SELECT FROM pg_tables
     WHERE schemaname = 'public' AND tablename = 'wallets'
   );

   -- Check if any profiles have wallet metadata
   SELECT COUNT(*) FROM profiles
   WHERE metadata ? 'wallets';
   ```

2. **Migrate Any Remaining Metadata Wallets**

   ```sql
   -- If any exist, migrate to wallets table
   INSERT INTO wallets (profile_id, user_id, address_or_xpub, label, is_primary)
   SELECT
     p.id as profile_id,
     p.id as user_id,
     w->>'address' as address_or_xpub,
     w->>'label' as label,
     true as is_primary
   FROM profiles p,
   LATERAL jsonb_array_elements(p.metadata->'wallets') w
   WHERE p.metadata ? 'wallets';

   -- Clean up metadata
   UPDATE profiles
   SET metadata = metadata - 'wallets'
   WHERE metadata ? 'wallets';
   ```

3. **Remove Fallback Code**
   - Delete `getFallbackProfileWallets()` function
   - Remove `isTableNotFoundError()` checks
   - Simplify GET /api/wallets route

4. **Update API Routes**

   ```typescript
   // Before (complex)
   try {
     const { data, error } = await query;
     if (error) {
       if (isTableNotFoundError(error) && profileId) {
         const fallbackWallets = await getFallbackProfileWallets(supabase, profileId);
         return NextResponse.json({ wallets: fallbackWallets });
       }
       return handleSupabaseError(error);
     }
     return NextResponse.json({ wallets: data || [] });
   } catch (innerError) {
     if (profileId && isTableNotFoundError(innerError)) {
       const fallbackWallets = await getFallbackProfileWallets(supabase, profileId);
       return NextResponse.json({ wallets: fallbackWallets });
     }
     return handleSupabaseError(innerError);
   }

   // After (simple)
   const { data, error } = await query;
   if (error) {
     return handleSupabaseError(error);
   }
   return apiSuccess(data || [], { cache: 'SHORT' });
   ```

#### Benefits:

- ✅ **Code Simplicity:** Remove 150+ lines of fallback logic
- ✅ **Type Safety:** Full TypeScript support
- ✅ **Performance:** No extra table existence checks
- ✅ **Feature Parity:** All wallets support full features
- ✅ **Maintainability:** Single source of truth

#### Risks:

- ⚠️ If migration not complete, some users lose wallet data
- ⚠️ Requires verification that wallets table exists everywhere

---

### Option B: Keep Fallback (Not Recommended)

**Action:** Document and maintain both systems.

#### Benefits:

- ✅ **Backward Compatible:** Works if table missing
- ✅ **Zero Risk:** No data loss

#### Drawbacks:

- ❌ **Technical Debt:** Maintains dual system indefinitely
- ❌ **Complexity:** Every route needs fallback logic
- ❌ **Type Safety:** Can't fully type wallet responses
- ❌ **Performance:** Extra checks on every request

---

## Decision Matrix

| Criteria            | Option A (Remove Fallback) | Option B (Keep Fallback) |
| ------------------- | -------------------------- | ------------------------ |
| **Code Complexity** | ⭐⭐⭐⭐⭐ Low             | ⭐⭐ High                |
| **Type Safety**     | ⭐⭐⭐⭐⭐ Full            | ⭐⭐ Partial             |
| **Performance**     | ⭐⭐⭐⭐⭐ Fast            | ⭐⭐⭐ Medium            |
| **Risk**            | ⭐⭐⭐ Medium              | ⭐⭐⭐⭐⭐ None          |
| **Maintainability** | ⭐⭐⭐⭐⭐ Easy            | ⭐⭐ Hard                |

---

## Recommended Implementation Plan

### Phase 1: Verification (Week 2)

1. ✅ Check if wallets table exists in all environments
2. ✅ Query for any remaining metadata wallets
3. ✅ Migrate any found wallets to table
4. ✅ Verify migration success

### Phase 2: Code Cleanup (Week 2)

1. ✅ Remove fallback functions from API routes
2. ✅ Simplify wallet GET endpoint
3. ✅ Update TypeScript types
4. ✅ Remove FALLBACK_WALLETS_KEY constant

### Phase 3: Testing (Week 2)

1. ✅ Test wallet CRUD operations
2. ✅ Test profile/project wallet display
3. ✅ Verify no errors in production logs
4. ✅ Monitor for fallback-related errors

### Phase 4: Cleanup (Week 3)

1. ✅ Remove metadata wallet migration code
2. ✅ Update documentation
3. ✅ Add indexes for wallet queries (already done in Week 1)

---

## Migration SQL Script

```sql
-- ============================================================================
-- Wallet Migration: Metadata to Table
-- Description: Migrate any remaining wallet data from profiles.metadata
-- Date: 2025-02-01
-- ============================================================================

BEGIN;

-- Step 1: Count existing metadata wallets
DO $$
DECLARE
  wallet_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wallet_count
  FROM profiles
  WHERE metadata ? 'wallets';

  RAISE NOTICE 'Found % profiles with wallet metadata', wallet_count;
END $$;

-- Step 2: Migrate wallets from metadata to table
-- Only migrate if they don't already exist in wallets table
INSERT INTO wallets (
  profile_id,
  user_id,
  address_or_xpub,
  wallet_type,
  label,
  description,
  category,
  is_primary,
  is_active,
  display_order,
  created_at
)
SELECT DISTINCT ON (p.id, w->>'address')
  p.id as profile_id,
  p.id as user_id,
  w->>'address' as address_or_xpub,
  CASE
    WHEN (w->>'address') LIKE 'xpub%' OR (w->>'address') LIKE 'ypub%' OR (w->>'address') LIKE 'zpub%'
    THEN 'xpub'::text
    ELSE 'address'::text
  END as wallet_type,
  COALESCE(w->>'label', 'Imported Wallet') as label,
  w->>'description' as description,
  COALESCE(w->>'category', 'general') as category,
  COALESCE((w->>'is_primary')::boolean, false) as is_primary,
  true as is_active,
  COALESCE((w->>'display_order')::integer, 0) as display_order,
  NOW() as created_at
FROM
  profiles p,
  LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(p.metadata->'wallets') = 'array'
      THEN p.metadata->'wallets'
      ELSE '[]'::jsonb
    END
  ) w
WHERE
  p.metadata ? 'wallets'
  AND w->>'address' IS NOT NULL
  AND w->>'address' != ''
  -- Don't migrate if already exists in wallets table
  AND NOT EXISTS (
    SELECT 1 FROM wallets
    WHERE profile_id = p.id
    AND address_or_xpub = w->>'address'
  );

-- Step 3: Verify migration
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM wallets
  WHERE created_at > NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Migrated % wallets to table', migrated_count;
END $$;

-- Step 4: Clean up metadata (optional - uncomment when confident)
-- UPDATE profiles
-- SET metadata = metadata - 'wallets'
-- WHERE metadata ? 'wallets';

COMMIT;

-- Verify: Check remaining metadata wallets (should be 0 after cleanup)
SELECT COUNT(*) as remaining_metadata_wallets
FROM profiles
WHERE metadata ? 'wallets';
```

---

## Files to Modify

### Remove Fallback Code:

1. `src/app/api/wallets/route.ts` - Remove getFallbackProfileWallets
2. `src/app/api/wallets/[id]/route.ts` - Remove fallback checks
3. `src/types/wallet.ts` - Clean up legacy types

### Simplify:

1. `src/components/wallets/WalletManager.tsx` - Remove fallback handling
2. `src/lib/wallets/` - Remove fallback utilities

---

## Success Criteria

1. ✅ Zero profiles with `metadata.wallets` after migration
2. ✅ All wallets in `wallets` table with proper schema
3. ✅ No fallback code paths in API routes
4. ✅ Type safety enforced throughout
5. ✅ Performance improved (no table existence checks)
6. ✅ Code reduced by ~150 lines

---

## Rollback Plan

If issues arise:

```sql
-- Restore wallets to metadata (emergency only)
UPDATE profiles p
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{wallets}',
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'address', w.address_or_xpub,
        'label', w.label,
        'category', w.category,
        'is_primary', w.is_primary
      )
    )
    FROM wallets w
    WHERE w.profile_id = p.id AND w.is_active = true
  )
)
WHERE EXISTS (
  SELECT 1 FROM wallets WHERE profile_id = p.id
);
```

---

## Timeline

- **Week 2 Day 1-2:** Verification & Migration SQL
- **Week 2 Day 3-4:** Code cleanup & testing
- **Week 2 Day 5:** Monitoring & validation
- **Week 3:** Final cleanup & documentation

---

## Conclusion

**Decision: Proceed with Option A** - Remove metadata fallback completely.

**Reasoning:**

1. Wallets table is production-ready
2. Migration can be verified before code changes
3. Significant code simplification
4. Better type safety and performance
5. Eliminates technical debt

**Next Steps:**

1. Run verification SQL
2. Execute migration SQL if needed
3. Remove fallback code
4. Deploy and monitor

**Approved by:** Architecture Team
**Implementation Owner:** Backend Team
**Target Completion:** Week 2 (2025-02-08)
