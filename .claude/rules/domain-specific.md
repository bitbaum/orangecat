# OrangeCat Domain-Specific Rules

**Purpose**: Project-specific patterns, terminology, and integration requirements

**Last Updated**: 2026-09-04

---

## Bitcoin Integration

### Bitcoin Orange Color

**CRITICAL**: Bitcoin Orange (#F7931A) is ONLY for Bitcoin-related elements

```tsx
// ✅ Correct usage
<div className="text-bitcoin-orange">  {/* Bitcoin balance */}
  {formatAmount(balance_btc)}  {/* Uses useDisplayCurrency hook */}
</div>

<BitcoinIcon className="text-bitcoin-orange" />

// ❌ Wrong usage
<Button className="bg-bitcoin-orange">  {/* Not Bitcoin-related! */}
  Create Product
</Button>
```

**Usage Rules**:

- Bitcoin logos, icons
- Bitcoin balance displays
- Lightning Network indicators
- Bitcoin-specific CTAs
- **Never** for general UI elements

---

### Bitcoin Amounts: BTC is the Unit

**CRITICAL**: Store Bitcoin amounts as BTC using `NUMERIC`/`DECIMAL` in the database. Satoshis are a Lightning protocol detail — they do not exist as a product concept.

```typescript
// ✅ Correct: store and work in BTC
const price_btc = 0.001; // DB column: NUMERIC(18, 8)
const balance_btc = 0.21;

// ❌ Never name fields _sats or store as integers
const price_sats = 100000; // WRONG — satoshis don't exist here
```

**Database Schema**:

```sql
-- ✅ BTC columns use NUMERIC for exact decimal arithmetic
CREATE TABLE user_products (
  price_btc NUMERIC(18, 8) NOT NULL,
  -- ...
);
```

---

### Currency Display (CRITICAL)

**Rule**: User-facing amounts MUST respect user's currency preference (defaults to CHF).

```typescript
// ✅ CORRECT: Use useDisplayCurrency hook in components
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';

function PriceDisplay({ price_btc }: Props) {
  const { formatAmount } = useDisplayCurrency();
  return <span>{formatAmount(price_btc)}</span>;
  // Shows "CHF 86.00", "0.001 BTC", or user's preferred currency
}
```

**When to use what**:

| Scenario                          | Use                                   | Output example         |
| --------------------------------- | ------------------------------------- | ---------------------- |
| User-facing amounts in components | `useDisplayCurrency().formatAmount()` | "CHF 86" / "0.001 BTC" |
| API responses                     | Raw BTC number                        | `{ price_btc: 0.001 }` |
| Internal calculations             | Raw BTC decimal                       | `0.001`                |

**SSOT Architecture**:

- Config: `src/config/currencies.ts` - Currency codes, default (CHF)
- Service: `src/services/currency` - Conversion & formatting functions
- Hook: `src/hooks/useDisplayCurrency.ts` - User preference + formatting
- User Pref: `src/hooks/useUserCurrency.ts` - Gets user's currency choice

---

### Lightning Network

**Use LNURL for payments**:

```typescript
import { generateLNURL, decodeLNURL } from '@/lib/bitcoin/lightning';

// ✅ Generate payment request
const lnurl = generateLNURL({
  amount_btc: 0.00001, // BTC amount; library converts to protocol units internally
  description: 'Coffee purchase',
  callback_url: `${baseUrl}/api/payments/callback`,
  metadata: {
    product_id: productId,
    user_id: userId,
  },
});

// ✅ Decode incoming LNURL
const decoded = decodeLNURL(lnurlString);
const { amount_btc, description } = decoded;
```

**Payment Flow**:

1. User initiates payment
2. Generate LNURL
3. Show QR code
4. User scans with Lightning wallet
5. Callback receives payment confirmation
6. Update order status

---

## Entity System

### Supported Entities

**All entities follow same patterns**:

```typescript
type EntityType =
  | 'product' // Physical/digital goods
  | 'service' // Professional services
  | 'project' // Fundraising projects
  | 'cause' // Charitable causes
  | 'event' // Events/meetups
  | 'loan' // Peer-to-peer lending
  | 'asset' // Real estate, assets
  | 'ai_assistant' // AI chatbots
  | 'organization' // Groups/companies
  | 'circle'; // Communities
```

**Entity Lifecycle**:

```
draft → active → paused → archived
  ↑                ↓
  └────────────────┘
```

**Transitions**:

- `draft → active`: Publish
- `active → paused`: Temporarily disable
- `paused → active`: Re-enable
- `active → archived`: Permanent disable
- `archived → draft`: Restore (rare)

---

### Actor System

**CRITICAL**: Everything is owned by an Actor

**What is an Actor?**:

- Abstraction for "who owns something"
- Users have actors
- Groups have actors
- Future: Organizations, companies have actors

```typescript
// ✅ Query by actor (works for users AND groups)
const { data: products } = await supabase.from('user_products').select('*').eq('actor_id', actorId);

// Get user's actor
const userActor = await getUserActor(userId);

// Get group's actor
const groupActor = await getGroupActor(groupId);

// ❌ Don't query by user_id directly
const { data } = await supabase.from('user_products').select('*').eq('user_id', userId); // WRONG! Use actor_id
```

**Database Schema**:

```sql
-- Actors table
CREATE TABLE actors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,  -- 'user', 'group', 'organization'
  user_id UUID REFERENCES auth.users(id),  -- If user
  group_id UUID REFERENCES groups(id),     -- If group
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Entities reference actor_id
CREATE TABLE user_products (
  id UUID PRIMARY KEY,
  actor_id UUID NOT NULL REFERENCES actors(id),  -- Who owns it
  -- ... other fields
);
```

**Benefits**:

- Unified ownership model
- Easy context switching (individual ↔ group)
- Future-proof (add new actor types)
- Consistent permissions

---

## Terminology & Voice

### Correct Terms (Use These)

**Financial**:

- "Funding" (not "donations")
- "Supporters" (not "donors")
- "Back this project" (not "donate to")
- "Fund" (verb, not "donate")
- "Transparency score" (consistent term)

**Bitcoin**:

- "Bitcoin" or "BTC" (not "crypto", not "sats", not "satoshis")
- "Lightning Network" (not "LN")
- "Bitcoin funding" (not "Bitcoin donations")

**Entities**:

- "Projects" (not "campaigns" or "creators")
- "Products" (clear and simple)
- "Services" (not "offerings")
- "Assets" (not "properties")

### Avoid These Terms

- ❌ "Donate" / "Donation" (implies charity)
- ❌ "Charity" (we're broader than that)
- ❌ "Tip" (implies optional)
- ❌ "Crowdfunding" (we're beyond that)
- ❌ "Crypto" (specifically Bitcoin)

### Voice & Tone

**Professional yet approachable**:

```
✅ "Back this project with Bitcoin"
❌ "Donate crypto to this campaign"

✅ "Support creators directly"
❌ "Give money to people"

✅ "Transparent funding for impactful projects"
❌ "Donate to charities"
```

---

## Self-Hosted Supabase on Hetzner (SSOT)

### Critical Rules

The database is a **self-hosted Supabase instance on the Hetzner box** at
`https://supabase.orangecat.ch`. It is the single source of truth.

- Connection string + keys in `.env.local` (already points at the self-host)
- **The managed Supabase Cloud project (`ohkueislstxomdjavyhs`) is RETIRED (2026-06)**

**Environment Variables**:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://supabase.orangecat.ch
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Why self-hosted on Hetzner**:

- We own the data and the box — no managed-cloud dependency or fair-use limits
- Single SSOT for prod and (per current setup) local dev
- Real-time, auth, storage all served from the one instance

**Do NOT**:

```bash
# ❌ Don't use the retired managed cloud or its MCP
mcp_supabase_*            # talks to managed-cloud Management API — retired
# ❌ Don't spin up a throwaway local stack for normal work
pnpm exec supabase start
```

**Use Instead**:

```bash
# ✅ Talk to the self-hosted DB directly
psql "$POSTGRES_URL" -c 'select 1;'
# ✅ Schema changes = a new file in supabase/migrations/ applied to the self-host
```

---

## Protected Files

### Never Modify Without Backup

**Environment Files**:

- `.env.local` - Always backup first
- `.env-backups/` - Never delete

**Migration Files**:

- `supabase/migrations/*.sql` - Immutable once applied
- Never edit existing migrations
- Always create new migration for changes

**Core Config**:

- `src/config/entity-registry.ts` - Requires full understanding
- Changes affect entire system

**Backup Before Changes**:

```bash
# Use env manager
node scripts/utils/env-manager.js backup

# Verify backup exists
ls .env-backups/

# Make changes
# ...

# Restore if needed
node scripts/utils/env-manager.js restore
```

---

## Context-Aware Navigation

### Individual vs Group Context

**Two contexts**:

1. **Individual**: User's personal space
2. **Group**: Group/organization space

```typescript
// Detect context from URL
if (pathname.startsWith('/groups/')) {
  context = { type: 'group', groupId, role };
} else {
  context = { type: 'individual', userId };
}

// Adapt navigation
const navigation = context.type === 'individual' ? individualNavigation : groupNavigation;
```

**Individual Context**:

- User's own entities
- Personal dashboard
- Individual wallets
- Personal settings

**Group Context**:

- Group's entities
- Group dashboard
- Group treasury
- Group settings
- Member management

**Visual Indicators**:

- **Individual**: 👤 icon, Blue theme, "You"
- **Group**: 🏢 icon, Purple theme, Group name

---

## Deployment

### Self-Hosted Production (Hetzner)

Production runs self-hosted on the Hetzner box (`bitbaum`), behind Caddy.
There is no Vercel.

```
main branch → deployed to bitbaum via .github/workflows/cd.yml
              (or run scripts/deploy-selfhost.sh)
```

**Environment Variables**:

- Production env lives in `/opt/orangecat/app/.env` on the box
- `.env.local` for local development
- No `vercel env pull` — there is no Vercel

**Pre-Deployment Checklist**:

- [ ] All tests pass
- [ ] Type check passes
- [ ] Build succeeds locally (`SELF_HOST=1 pnpm run build`)
- [ ] No console.logs remaining
- [ ] Production env set in `/opt/orangecat/app/.env`
- [ ] Database migrations applied
- [ ] No breaking changes without communication

**Deployment Flow**:

```bash
# 1. Develop on feature branch
git checkout -b feature/add-warranty

# 2. Make changes, commit
git commit -m "feat: add warranty field"

# 3. Push + open a PR
git push origin feature/add-warranty
# GitHub Actions run type-check / lint / tests / build

# 4. Merge to main
# 5. cd.yml deploys to the box (or run scripts/deploy-selfhost.sh)
# 6. Verify https://orangecat.ch/api/health
```

---

## Data Migrations

### Creating Migrations

**Write a migration file and merge it — it applies itself on deploy** (`scripts/apply-migrations.sh`, run by `scripts/deploy-selfhost.sh`):

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_warranty_field.sql
ALTER TABLE user_products
ADD COLUMN warranty_period INTEGER;

CREATE INDEX idx_user_products_warranty
ON user_products(warranty_period);
```

**Migration Naming**:

```
Format: YYYYMMDDHHMMSS_description.sql

Examples:
20260106120000_add_warranty_field.sql
20260106130000_create_events_table.sql
20260106140000_add_rls_policies.sql
```

**Migration Rules**:

- Never edit existing migrations
- Always create new migration for changes
- Test on development database first
- Include rollback strategy in comments
- Update TypeScript types after migration

---

## Bitcoin Wallet Integration

### User Wallets

**Multiple wallets per user**:

```typescript
interface Wallet {
  id: string;
  actor_id: string;
  type: 'lightning' | 'onchain' | 'both';
  balance_btc: number;
  lnurl_address?: string;
  btc_address?: string;
  is_primary: boolean;
}
```

**Primary Wallet**:

- One wallet marked as primary
- Used for receiving payments by default
- User can change primary wallet

**Wallet Operations**:

```typescript
// Get user's primary wallet
const primaryWallet = await getUserPrimaryWallet(actorId);

// Get all user wallets
const wallets = await getUserWallets(actorId);

// Create new wallet
const wallet = await createWallet({
  actor_id: actorId,
  type: 'lightning',
  lnurl_address: 'user@orangecat.app',
});
```

---

## Search & Discovery

### Entity Search

**Search is unified across entity types**:

```typescript
// Search all entities
const results = await searchEntities({
  query: 'coffee',
  entityTypes: ['product', 'service', 'project'],
  filters: {
    status: 'active',
    price_range: [0, 100000],
  },
  sort: 'relevance',
  page: 1,
  pageSize: 20,
});
```

**Search Fields**:

- Title (weighted heavily)
- Description
- Tags
- Category
- Actor username

**Search Optimizations**:

- PostgreSQL full-text search
- Trigram similarity for fuzzy matching
- Cached popular searches
- Indexed for performance

---

## Rate Limiting

### API Rate Limits

**Per User**:

- Read operations: 100 requests/minute
- Write operations: 20 requests/minute
- Authenticated: 200 requests/minute
- Anonymous: 20 requests/minute

**Per IP** (fallback):

- 60 requests/minute

**Implementation**:

```typescript
export const GET = compose(
  withAuth(),
  withRateLimit('read') // 100/min for authenticated
)(handler);

export const POST = compose(
  withAuth(),
  withRateLimit('write') // 20/min for authenticated
)(handler);
```

---

## Monitoring & Logging

### Structured Logging

```typescript
// ✅ Structured logs with context
console.log('[Event]', {
  type: 'product_created',
  userId: user.id,
  productId: product.id,
  price_btc: product.price_btc,
  timestamp: new Date().toISOString(),
});

// Error logging
console.error('[Error]', {
  type: 'payment_failed',
  userId: user.id,
  amount_btc: amount,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString(),
});
```

### Key Metrics to Track

- User registrations
- Entity creations (by type)
- Bitcoin transactions
- Lightning payments
- Failed payments
- API errors
- Response times

---

## References

- **Bitcoin Utils**: `src/lib/bitcoin/`
- **Actor System**: `src/lib/actors/`
- **Entity Registry**: `src/config/entity-registry.ts`
- **Remote Supabase**: `docs/operations/REMOTE_ONLY_SUPABASE.md`
- **Deployment**: `docs/operations/deployment/DEPLOYMENT_PROCESS.md`
- **Terminology Guide**: `docs/design/TERMINOLOGY.md`

---

**Remember**: OrangeCat is a Bitcoin-native platform. BTC is the unit. Transparency is the goal. Actors unify ownership.
