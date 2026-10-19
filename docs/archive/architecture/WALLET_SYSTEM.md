# Multi-Wallet System Architecture

**Status**: ✅ Ready for Implementation
**Date**: 2025-11-12
**Migration**: `20251112000000_create_wallets_system.sql`

---

## Overview

OrangeCat's wallet system allows both **profiles** (individuals) and **projects** to have multiple Bitcoin wallets for different purposes. Donors can choose which specific wallet to support.

### Key Features

✅ **Simple & User-Friendly**: Easy to add/manage wallets
✅ **Categorized Wallets**: Rent, Food, Medical, Education, etc.
✅ **xpub Support**: Automatic address derivation from extended public keys
✅ **Single Address Support**: Works with simple Bitcoin addresses too
✅ **Goal Tracking**: Optional goals per wallet
✅ **Balance Refresh**: Manual refresh with 5-minute cooldown
✅ **Unified System**: Same code works for profiles and projects

---

## Database Schema

### `wallets` Table

The main table that stores wallet information for both profiles and projects.

```sql
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY,

  -- Owner (exactly one must be set)
  profile_id UUID REFERENCES profiles(id),
  project_id UUID REFERENCES projects(id),

  -- Wallet info
  label TEXT NOT NULL,                    -- "Monthly Rent", "Food Fund"
  description TEXT,                       -- Optional explanation

  -- Bitcoin
  address_or_xpub TEXT NOT NULL,          -- bc1q... or zpub...
  wallet_type TEXT DEFAULT 'address',     -- 'address' or 'xpub'

  -- Category
  category TEXT DEFAULT 'general',        -- Predefined or 'custom'
  category_icon TEXT DEFAULT '💰',        -- Emoji for display

  -- Optional goal
  goal_amount NUMERIC(20,8),
  goal_currency TEXT DEFAULT 'USD',
  goal_deadline TIMESTAMPTZ,

  -- Balance
  balance_btc NUMERIC(20,8) DEFAULT 0,
  balance_updated_at TIMESTAMPTZ,

  -- Display
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT check_has_owner CHECK (
    (profile_id IS NOT NULL AND project_id IS NULL) OR
    (profile_id IS NULL AND project_id IS NOT NULL)
  ),
  CONSTRAINT check_max_10_wallets CHECK (...)
);
```

### `wallet_addresses` Table

Stores derived addresses for xpub wallets (auto-populated).

```sql
CREATE TABLE public.wallet_addresses (
  id UUID PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id),
  address TEXT NOT NULL,
  derivation_index INT NOT NULL,
  balance_btc NUMERIC(20,8) DEFAULT 0,
  tx_count INT DEFAULT 0,
  last_tx_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Wallet Categories

Predefined categories with icons for better UX:

| Category         | Icon | Description                      |
| ---------------- | ---- | -------------------------------- |
| `general`        | 💰   | General purpose donations        |
| `rent`           | 🏠   | Rent & housing costs             |
| `food`           | 🍔   | Food & groceries                 |
| `medical`        | 💊   | Medical expenses & healthcare    |
| `education`      | 🎓   | School fees & learning materials |
| `emergency`      | 🚨   | Urgent unexpected expenses       |
| `transportation` | 🚗   | Travel & commute costs           |
| `utilities`      | 💡   | Power, water, internet bills     |
| `custom`         | 📦   | Other custom categories          |

---

## API Endpoints

### `GET /api/wallets`

Fetch wallets for a profile or project.

**Query Parameters:**

- `profile_id` (UUID) - Get wallets for a profile
- `project_id` (UUID) - Get wallets for a project

**Response:**

```json
{
  "wallets": [
    {
      "id": "uuid",
      "label": "Monthly Rent",
      "description": "Help cover my housing costs",
      "address_or_xpub": "bc1q...",
      "wallet_type": "address",
      "category": "rent",
      "category_icon": "🏠",
      "balance_btc": 0.05,
      "goal_amount": 1500,
      "goal_currency": "USD",
      "balance_updated_at": "2025-11-12T10:30:00Z",
      "is_primary": true,
      ...
    }
  ]
}
```

### `POST /api/wallets`

Create a new wallet.

**Body:**

```json
{
  "profile_id": "uuid", // OR project_id
  "label": "Food Budget",
  "description": "Monthly groceries",
  "address_or_xpub": "zpub...",
  "category": "food",
  "goal_amount": 400,
  "goal_currency": "USD"
}
```

**Response:** `201 Created`

```json
{
  "wallet": { ... }
}
```

### `PATCH /api/wallets/[id]`

Update an existing wallet.

**Body:** (all fields optional)

```json
{
  "label": "Updated Name",
  "description": "New description",
  "goal_amount": 500
}
```

### `DELETE /api/wallets/[id]`

Soft delete a wallet (sets `is_active = false`).

**Response:**

```json
{
  "success": true
}
```

### `POST /api/wallets/[id]/refresh`

Refresh wallet balance from blockchain.

**Rate Limit:** 5 minutes cooldown

**Response:**

```json
{
  "wallet": { ... },
  "message": "Balance refreshed successfully"
}
```

---

## Usage Examples

### For Profiles (Personal Fundraising)

Sarah creates multiple wallets for her personal needs:

```typescript
// 1. Rent wallet
await createWallet({
  profile_id: sarah.id,
  label: 'Monthly Rent',
  category: 'rent',
  address_or_xpub: 'zpub6r...', // Her rent xpub
  goal_amount: 1200,
  goal_currency: 'USD',
});

// 2. Food wallet
await createWallet({
  profile_id: sarah.id,
  label: 'Groceries',
  category: 'food',
  address_or_xpub: 'zpub6s...', // Her food xpub
  goal_amount: 400,
  goal_currency: 'USD',
});
```

**Donor Experience:**

```
Support Sarah
○ 🏠 Rent ($950/$1200) - 79% funded
● 🍔 Groceries ($120/$400) - 30% funded
○ 💊 Medical ($0/$800) - 0% funded
```

Donors choose which need to support!

---

### For Projects

A community project has multiple funding categories:

```typescript
// Create project wallets
await createWallet({
  project_id: project.id,
  label: 'Food Program',
  category: 'food',
  address_or_xpub: 'bc1q...',
  goal_amount: 5000,
  goal_currency: 'USD',
});

await createWallet({
  project_id: project.id,
  label: 'School Supplies',
  category: 'education',
  address_or_xpub: 'bc1p...',
  goal_amount: 2000,
  goal_currency: 'USD',
});
```

---

## Address vs xpub

### Single Address (Simple)

**When to use:**

- User has a specific address for donations
- Simple mobile wallet (BlueWallet, Muun, etc.)
- One-time fundraising

**Pros:**
✅ Very simple
✅ Works with any wallet
✅ No setup required

**Cons:**
❌ Only tracks one address
❌ Misses change addresses
❌ Not scalable

**Example:**

```
address_or_xpub: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
wallet_type: "address"
```

---

### Extended Public Key (xpub) - **RECOMMENDED**

**When to use:**

- User has an HD wallet (most modern wallets)
- Ongoing fundraising
- Want comprehensive tracking

**Pros:**
✅ Tracks ALL addresses in wallet
✅ Automatically derives new addresses
✅ Handles change addresses
✅ Professional solution

**Cons:**
❌ Requires xpub export from wallet
❌ Privacy consideration (reveals all addresses)

**Example:**

```
address_or_xpub: "zpub6r4GZg1BLgZU8YBvxz7E3..."
wallet_type: "xpub"
```

**Supported formats:**

- `xpub` - Legacy (P2PKH)
- `ypub` - SegWit wrapped (P2SH-P2WPKH)
- `zpub` - Native SegWit (P2WPKH) ⭐ **Recommended**

---

## Balance Tracking

### Single Address

1. User adds address
2. System fetches balance from mempool.space
3. Stores `balance_btc` directly
4. Updates on manual refresh (5-min cooldown)

```typescript
const balance = await fetchBitcoinBalance(wallet.address_or_xpub);
// Updates wallet.balance_btc
```

---

### xpub (Extended Public Key)

1. User adds xpub
2. System queries mempool.space xpub endpoint
3. Gets total balance across all derived addresses
4. (Future) Derives individual addresses and stores in `wallet_addresses`

```typescript
// Current implementation (MVP)
const res = await fetch(`https://mempool.space/api/v1/xpub/${xpub}`);
const data = await res.json();
const balanceSats = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
const balanceBtc = balanceSats / 100_000_000;

// Future: Derive addresses using BIP32/84
// Store in wallet_addresses table
```

---

## Security & Privacy

### Row-Level Security (RLS)

**Public can view:**

- Active wallets for active projects
- Wallets for public profiles

**Owners can:**

- View all their wallets (any status)
- Create/update/delete their own wallets
- Refresh balances

**Policies:**

```sql
-- Public read for active wallets
CREATE POLICY "wallets_select_public" ON wallets FOR SELECT
  USING (is_active = true AND ...);

-- Owner full access
CREATE POLICY "wallets_select_own" ON wallets FOR SELECT
  USING (auth.uid() = owner_user_id);
```

---

### xpub Privacy Considerations

⚠️ **Important:** An xpub reveals ALL addresses derived from it (read-only).

**What xpub reveals:**

- All receive addresses
- All change addresses
- Transaction history
- Total balance

**What xpub CANNOT do:**

- Cannot spend funds
- Cannot derive private keys
- Cannot sign transactions

**Recommendation:**

- Only share xpubs for transparency purposes
- Consider using dedicated xpubs for fundraising
- Don't use your main wallet's xpub if you value privacy

---

## Migration Path

### From Old System (single `bitcoin_address`)

**Option 1: Automatic Migration (Recommended)**

When user edits project with old `bitcoin_address`:

1. Create primary wallet from `bitcoin_address`
2. Keep old field for backward compatibility
3. Display uses new wallet system

```sql
-- On project edit, migrate old address
INSERT INTO wallets (project_id, label, address_or_xpub, category, is_primary)
VALUES (project.id, 'Primary Wallet', project.bitcoin_address, 'general', true);
```

**Option 2: Gradual Migration**

Show banner on project page:

```
"🎉 New feature! Create multiple wallets for different purposes."
[Migrate to new system]
```

---

## Frontend Integration

### Using the WalletManager Component

```tsx
import { WalletManager } from '@/components/wallets/WalletManager';

function ProfilePage({ profile, wallets }) {
  return (
    <WalletManager
      wallets={wallets}
      entityType="profile"
      entityId={profile.id}
      isOwner={isCurrentUser}
      onAdd={async data => {
        await fetch('/api/wallets', {
          method: 'POST',
          body: JSON.stringify({ ...data, profile_id: profile.id }),
        });
      }}
      onUpdate={async (id, data) => {
        await fetch(`/api/wallets/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      }}
      onDelete={async id => {
        await fetch(`/api/wallets/${id}`, { method: 'DELETE' });
      }}
      onRefresh={async id => {
        await fetch(`/api/wallets/${id}/refresh`, { method: 'POST' });
      }}
    />
  );
}
```

---

## Testing Checklist

### Database

- [ ] Migration runs successfully
- [ ] RLS policies work correctly
- [ ] Constraint checks enforce max 10 wallets
- [ ] Helper functions return correct balances

### API

- [ ] Create wallet for profile
- [ ] Create wallet for project
- [ ] Cannot create wallet for other user's profile/project
- [ ] Cannot exceed 10 wallets
- [ ] Address validation works
- [ ] xpub validation works
- [ ] Update wallet succeeds
- [ ] Delete wallet (soft delete) works
- [ ] Refresh has 5-minute cooldown

### UI

- [ ] Wallet list displays correctly
- [ ] Category icons show properly
- [ ] Add wallet form validates input
- [ ] Edit wallet updates correctly
- [ ] Delete confirmation works
- [ ] Refresh button shows loading state
- [ ] Progress bars display correctly
- [ ] Copy address to clipboard works

### Balance Tracking

- [ ] Single address balance fetches correctly
- [ ] xpub balance fetches correctly
- [ ] Rate limiting enforces 5-min cooldown
- [ ] Invalid address/xpub returns error
- [ ] Balance displays in UI after refresh

---

## Future Enhancements

### Phase 2: Full xpub Derivation

- Derive individual addresses using BIP32/84
- Store addresses in `wallet_addresses` table
- Track per-address balances
- Gap limit: 20 (BIP44 standard)

### Phase 3: Transaction History

- Create `wallet_transactions` table
- Store individual transactions
- Show transaction feed in UI
- Enable "proof of donation"

### Phase 4: Advanced Features

- Automatic balance refresh (cron job)
- Webhook notifications on new transactions
- QR code generation per wallet
- Lightning Network integration
- Multi-sig wallet support

---

## Deployment

### Apply Migration

```bash
# Apply to Supabase
psql $DATABASE_URL < supabase/migrations/20251112000000_create_wallets_system.sql

# Verify
psql $DATABASE_URL -c "\d wallets"
psql $DATABASE_URL -c "SELECT tablename, policyname FROM pg_policies WHERE tablename = 'wallets';"
```

### Environment Variables

No new environment variables needed! Uses existing:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Deployment

```bash
git add .
git commit -m "feat: multi-wallet system for profiles and projects"
git push origin main

# Green CI on main; deploy on the Hetzner box via the self-host flow
# (scripts/deploy-selfhost.sh). See docs/operations/deployment/DEPLOYMENT_PROCESS.md
```

---

## Summary

**What we built:**

- ✅ Unified wallet system for profiles and projects
- ✅ Support for both single addresses and xpubs
- ✅ Categorized wallets (rent, food, medical, etc.)
- ✅ Goal tracking per wallet
- ✅ Manual balance refresh with rate limiting
- ✅ Simple, user-friendly UI
- ✅ Full API with RLS security

**What donors see:**

- Choose which wallet/category to support
- See progress per category
- Transparent balance tracking

**What fundraisers get:**

- Easy wallet management
- Automatic address derivation (xpub)
- Accurate balance tracking
- Category-based fundraising

**Next steps:**

1. Apply migration
2. Test wallet creation
3. Test balance refresh
4. Deploy to production
5. Announce new feature!
