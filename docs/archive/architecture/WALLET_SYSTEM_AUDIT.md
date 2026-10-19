# Wallet System Code Audit - Critical Issues Found

**Audited**: 2025-11-12
**Status**: ⚠️ **MAJOR ISSUES FOUND - DO NOT DEPLOY**

---

## 🚨 Critical Issues

### 1. CHECK CONSTRAINT USES SUBQUERY - **WILL FAIL**

**Location**: `supabase/migrations/20251112000000_create_wallets_system.sql:52-59`

**Problem**:
```sql
CONSTRAINT check_max_10_wallets CHECK (
  CASE
    WHEN profile_id IS NOT NULL THEN
      (SELECT COUNT(*) FROM wallets WHERE profile_id = wallets.profile_id AND is_active = true) <= 10
    -- ^^^ THIS SUBQUERY WILL FAIL!
```

**Why this is wrong:**
- PostgreSQL CHECK constraints **cannot contain subqueries**
- This will either fail at migration time OR silently not enforce the limit
- Classic AI-generated code that "looks right" but doesn't work

**Correct approach:**
Use a **trigger** instead:
```sql
CREATE OR REPLACE FUNCTION check_wallet_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.profile_id IS NOT NULL AND NEW.is_active = true) THEN
    IF (SELECT COUNT(*) FROM wallets
        WHERE profile_id = NEW.profile_id AND is_active = true) >= 10 THEN
      RAISE EXCEPTION 'Maximum 10 wallets per profile';
    END IF;
  END IF;

  IF (NEW.project_id IS NOT NULL AND NEW.is_active = true) THEN
    IF (SELECT COUNT(*) FROM wallets
        WHERE project_id = NEW.project_id AND is_active = true) >= 10 THEN
      RAISE EXCEPTION 'Maximum 10 wallets per project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_wallet_limit
  BEFORE INSERT OR UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION check_wallet_limit();
```

---

### 2. SECURITY DEFINER WITHOUT INPUT VALIDATION

**Location**: `supabase/migrations/20251112000000_create_wallets_system.sql:184-204`

**Problem**:
```sql
CREATE OR REPLACE FUNCTION get_wallet_total_balance(wallet_uuid UUID)
RETURNS NUMERIC(20,8) AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Why this is wrong:**
- `SECURITY DEFINER` runs with **elevated privileges** (bypasses RLS)
- No RLS check - anyone can call this with any wallet_uuid
- Could leak balance information for private wallets

**Correct approach:**
```sql
CREATE OR REPLACE FUNCTION get_wallet_total_balance(wallet_uuid UUID)
RETURNS NUMERIC(20,8) AS $$
DECLARE
  wallet_type_val TEXT;
  balance NUMERIC(20,8);
  has_access BOOLEAN;
BEGIN
  -- CHECK RLS: Can the current user see this wallet?
  SELECT EXISTS(
    SELECT 1 FROM wallets
    WHERE id = wallet_uuid
    AND (
      -- Public wallet
      (is_active = true AND (
        (project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM projects WHERE id = wallets.project_id AND status = 'active'
        ))
        OR profile_id IS NOT NULL
      ))
      -- Or owner
      OR auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
      OR auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
    )
  ) INTO has_access;

  IF NOT has_access THEN
    RAISE EXCEPTION 'Access denied to wallet %', wallet_uuid;
  END IF;

  -- Rest of function...
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Or better**: Don't use SECURITY DEFINER at all. Use `SECURITY INVOKER` (default) and let RLS handle it.

---

### 3. RLS POLICIES HAVE N+1 QUERY PROBLEMS

**Location**: `supabase/migrations/20251112000000_create_wallets_system.sql:127-156`

**Problem**:
```sql
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM profiles WHERE id = profile_id)
    OR auth.uid() = (SELECT user_id FROM projects WHERE id = project_id)
  );
```

**Why this is suboptimal:**
- Every row access triggers 2 subqueries
- On a page with 10 wallets = 20 extra queries
- Performance will degrade as data grows

**Better approach:**
Add `user_id` column directly to wallets table (denormalized):
```sql
ALTER TABLE wallets ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Set via trigger when inserting
CREATE TRIGGER set_wallet_user_id
  BEFORE INSERT ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION set_user_id_from_owner();

-- Then policy becomes simple:
CREATE POLICY "wallets_select_own"
  ON public.wallets FOR SELECT
  USING (auth.uid() = user_id);
```

---

### 4. BITCOIN ADDRESS VALIDATION IS INCOMPLETE

**Location**: `src/types/wallet.ts:144-151`

**Problem**:
```typescript
export function isValidBitcoinAddress(address: string): boolean {
  const patterns = {
    legacy: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    segwit: /^3[a-km-zA-HJ-NP-Z1-9]{25,34}$/,
    bech32: /^(bc1|tb1)[a-z0-9]{39,87}$/i,
  };
  return Object.values(patterns).some((pattern) => pattern.test(address));
}
```

**Why this is wrong:**
- Doesn't validate **checksum** (can accept invalid addresses!)
- Doesn't distinguish between mainnet/testnet
- Regex for bech32 is too permissive (allows invalid characters)
- Doesn't support Taproot (bc1p...) addresses

**Correct approach:**
Use a proper library:
```typescript
import { validate } from 'bitcoin-address-validation';

export function isValidBitcoinAddress(address: string): boolean {
  return validate(address, 'mainnet'); // or 'testnet' for testing
}
```

Or implement proper validation with checksum verification.

---

### 5. XPUB VALIDATION IS BROKEN

**Location**: `src/types/wallet.ts:156-159`

**Problem**:
```typescript
export function isValidXpub(xpub: string): boolean {
  const prefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub'];
  return prefixes.some((prefix) => xpub.startsWith(prefix)) && xpub.length > 100;
}
```

**Why this is wrong:**
- Length check is arbitrary (xpubs are 111 chars for mainnet, but can vary)
- No checksum validation
- Doesn't verify base58check encoding
- Will accept garbage like "xpubAAAAAAAAAAA..." (111 A's)

**Correct approach:**
```typescript
import bs58check from 'bs58check';

export function isValidXpub(xpub: string): boolean {
  try {
    const prefixes = ['xpub', 'ypub', 'zpub', 'tpub', 'upub', 'vpub'];

    if (!prefixes.some(p => xpub.startsWith(p))) {
      return false;
    }

    // Verify base58check encoding and checksum
    const decoded = bs58check.decode(xpub);

    // Verify length (should be 78 bytes after decoding)
    if (decoded.length !== 78) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
```

---

### 6. MEMPOOL.SPACE API HAS NO ERROR HANDLING

**Location**: `src/app/api/wallets/[id]/refresh/route.ts:72-94`

**Problem**:
```typescript
const res = await fetch(`https://mempool.space/api/v1/xpub/${wallet.address_or_xpub}`, {
  headers: { Accept: 'application/json' },
});

if (!res.ok) {
  throw new Error(`Mempool API error: ${res.status}`);
}
```

**Issues**:
- No timeout (could hang indefinitely)
- No retry logic
- No rate limit handling from mempool.space (they rate limit!)
- Leaks xpub in URL (logged in server logs)
- No caching

**Correct approach:**
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

try {
  const res = await fetch(`https://mempool.space/api/v1/xpub/${wallet.address_or_xpub}`, {
    headers: { Accept: 'application/json' },
    signal: controller.signal,
    // Consider using Next.js caching
    next: { revalidate: 300 } // 5 min cache
  });

  clearTimeout(timeoutId);

  if (res.status === 429) {
    // Rate limited
    return NextResponse.json(
      { error: 'External API rate limited, try again later' },
      { status: 429 }
    );
  }

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  // ... rest
} catch (error) {
  clearTimeout(timeoutId);
  if (error.name === 'AbortError') {
    return NextResponse.json(
      { error: 'Balance fetch timeout' },
      { status: 504 }
    );
  }
  throw error;
}
```

---

### 7. REACT COMPONENT HAS PROP DRILLING AND NO ERROR BOUNDARIES

**Location**: `src/components/wallets/WalletManager.tsx`

**Problems**:
- Lots of callbacks passed down (prop drilling)
- No error boundary for API failures
- Optimistic updates without rollback
- No loading states for operations
- `alert()` for clipboard feedback (bad UX)
- Form validation happens client-side only (can be bypassed)

**Should have:**
- Error boundaries
- Toast notifications instead of alert()
- Optimistic UI with rollback on error
- Proper loading/disabled states
- Server-side validation enforcement

---

### 8. NO TRANSACTION SAFETY IN API ENDPOINTS

**Location**: `src/app/api/wallets/route.ts:POST`

**Problem**:
```typescript
// Check if first wallet
const { data: existingWallets } = await supabase
  .from('wallets')
  .select('id')
  .eq(profile_id ? 'profile_id' : 'project_id', profile_id || project_id)
  .eq('is_active', true);

const isFirstWallet = !existingWallets || existingWallets.length === 0;

// Create wallet
const { data: wallet, error } = await supabase
  .from('wallets')
  .insert({ ... is_primary: isFirstWallet })
```

**Race condition:**
If two wallets are created simultaneously, both could be marked as `is_primary`.

**Fix:**
Use PostgreSQL transactions or handle in a single query with UPSERT logic.

---

### 9. MISSING INPUT SANITIZATION

**Location**: `src/app/api/wallets/route.ts:62-77`

**Problem**:
```typescript
const { data: wallet, error } = await supabase
  .from('wallets')
  .insert({
    label: body.label.trim(),
    description: body.description?.trim() || null,
    category_icon: body.category_icon || '💰',  // <-- UNSANITIZED EMOJI
    // ...
  })
```

**Issues**:
- `category_icon` is not validated (could be exploited for XSS if rendered unsafely)
- `label` could contain control characters
- `description` could be very long (no max length check)

**Fix:**
```typescript
// Sanitize emoji
const allowedEmojis = ['💰', '🏠', '🍔', '💊', '🎓', '🚨', '🚗', '💡', '📦'];
const safeIcon = allowedEmojis.includes(body.category_icon)
  ? body.category_icon
  : '💰';

// Validate label length
if (body.label.length > 100) {
  return NextResponse.json({ error: 'Label too long (max 100 chars)' }, { status: 400 });
}

// Validate description length
if (body.description && body.description.length > 500) {
  return NextResponse.json({ error: 'Description too long (max 500 chars)' }, { status: 400 });
}
```

---

## ⚠️ Medium Priority Issues

### 10. No Idempotency for Balance Refresh
- If refresh fails mid-way, could have inconsistent state
- Should use `balance_updated_at` as a lock

### 11. No Audit Trail
- Who created/modified wallets?
- When was balance last refreshed?
- Should add `created_by`, `updated_by` columns

### 12. No Soft Delete Verification
- What happens to donations pointing to deleted wallets?
- Should cascade or prevent deletion if donations exist

### 13. Missing Indexes
```sql
-- For ownership lookups
CREATE INDEX idx_wallets_user_lookup ON wallets(profile_id, is_active) WHERE profile_id IS NOT NULL;
CREATE INDEX idx_wallets_project_lookup ON wallets(project_id, is_active) WHERE project_id IS NOT NULL;

-- For balance aggregation
CREATE INDEX idx_wallets_balance ON wallets(balance_btc) WHERE balance_btc > 0;
```

---

## 📊 Code Quality Issues (AI Slop Indicators)

1. ✅ **Over-commented code** - Every line has obvious comments
2. ✅ **Magic numbers without constants** - `100_000_000` hardcoded multiple times
3. ✅ **Inconsistent error messages** - Sometimes "error", sometimes "message"
4. ✅ **No error codes** - Just string messages (hard to handle on frontend)
5. ✅ **TODOs in production code** - Line 86: "TODO: Store individual addresses"
6. ✅ **Unused table** - `wallet_addresses` created but never populated
7. ✅ **Function never called** - `get_wallet_total_balance()` and `get_entity_total_balance()` not used anywhere
8. ✅ **No tests** - Zero test coverage

---

## 🎯 Recommendation

**DO NOT deploy this code as-is.**

Critical issues that MUST be fixed:
1. Replace CHECK constraint with trigger (will break otherwise)
2. Fix SECURITY DEFINER functions or remove them
3. Use proper Bitcoin address/xpub validation library
4. Add timeout and error handling to external API calls
5. Add input sanitization and length limits
6. Add transaction safety to prevent race conditions

Would you like me to:
1. **Create fixed versions** of each problematic file?
2. **Write tests** for the wallet system?
3. **Implement proper Bitcoin validation** with a library?
4. **Start over with a simpler, correct approach**?

This is a good architecture idea, but the implementation needs significant work to be production-ready.
