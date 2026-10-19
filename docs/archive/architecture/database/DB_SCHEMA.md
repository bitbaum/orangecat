# OrangeCat MVP Database Schema

## Simple MVP Schema: Profiles + Projects Only

### Tables

#### 1. profiles

Stores individual user profiles.

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,

  -- Basic info
  username text UNIQUE NOT NULL,
  name text,
  bio text,
  location text,

  -- Bitcoin addresses
  bitcoin_address text,
  lightning_address text,

  -- Branding
  avatar_url text,
  banner_url text,
  website text,

  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### 2. projects

Stores fundraising projects created by individual users.

```sql
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Basic info
  title text NOT NULL,
  description text,

  -- Funding
  goal_amount numeric(20,8),
  currency text DEFAULT 'SATS',
  raised_amount numeric(20,8) DEFAULT 0,
  funding_purpose text,

  -- Bitcoin addresses
  bitcoin_address text,
  lightning_address text,

  -- Categorization
  category text,
  tags text[] DEFAULT '{}',

  -- Status
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),

  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### 3. transactions

Stores Bitcoin payments/donations.

```sql
CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Amount
  amount_sats bigint NOT NULL,
  currency text DEFAULT 'SATS',

  -- Source (who paid)
  from_entity_type text CHECK (from_entity_type IN ('profile', 'project')),
  from_entity_id uuid,

  -- Destination (who received)
  to_entity_type text CHECK (to_entity_type IN ('profile', 'project')),
  to_entity_id uuid,

  -- Payment method
  payment_method text CHECK (payment_method IN ('bitcoin', 'lightning', 'on-chain', 'off-chain')),

  -- Metadata
  message text,
  purpose text,
  anonymous boolean DEFAULT false,
  public_visibility boolean DEFAULT true,

  -- Timestamps
  created_at timestamp with time zone DEFAULT now()
);
```

### What Was Removed (Not in MVP)

- ❌ organizations table
- ❌ organization_members table
- ❌ profile_associations table
- ❌ memberships table
- ❌ campaigns table (renamed to projects)
- ❌ events table
- ❌ assets table

### Key Points

1. **Simple ownership**: Projects have `user_id` → owned by individual profiles
2. **No complex relationships**: Just projects ↔ users
3. **Flexible currency**: Projects can use CHF, USD, EUR, BTC, or SATS
4. **Clean transactions**: Between profiles and projects only

### Migration Order

1. Apply `20250124_consolidate_to_projects.sql` to fix schema
2. Apply `20250124_remove_non_mvp_entities.sql` to remove org tables

### Indexes

```sql
-- Projects
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Transactions
CREATE INDEX idx_transactions_to_entity ON transactions(to_entity_type, to_entity_id);
CREATE INDEX idx_transactions_from_entity ON transactions(from_entity_type, from_entity_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
```
