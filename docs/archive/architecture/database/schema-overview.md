# 📐 Database Schema Overview

> A high-level view of OrangeCat's database architecture

## Architecture Philosophy

OrangeCat's database is designed with three core principles:

1. **Bitcoin-Native**: Built specifically for Bitcoin/Lightning Network payments with proper precision
2. **Flexible & Extensible**: JSONB fields and polymorphic associations allow growth without migrations
3. **Security-First**: Row Level Security (RLS) on every table, principle of least privilege

## Entity Relationship Diagram

```
┌─────────────┐
│   auth.users│ (Supabase Auth)
└──────┬──────┘
       │
       │ 1:1
       ▼
┌─────────────────────────────────────────────────────┐
│                    profiles                         │
│  • Core user data (username, name, bio)     │
│  • Bitcoin addresses (on-chain + Lightning)         │
│  • Social stats (followers, views)                  │
│  • Verification status                              │
└─────────────┬──────────────────────┬────────────────┘
              │                      │
              │ 1:N                  │ 1:N
              ▼                      ▼
      ┌──────────────┐       ┌──────────────────┐
      │funding_pages │       │  organizations   │
      │              │       │  • Multi-user    │
      │ • Projects  │       │  • Governance    │
      │ • Goals      │       │  • Treasury      │
      │ • Status     │       └────────┬─────────┘
      └──────┬───────┘                │
             │                        │ 1:N
             │ 1:N                    ▼
             ▼                 ┌─────────────────┐
      ┌─────────────┐          │   memberships   │
      │transactions │          │  • Roles        │
      │             │          │  • Permissions  │
      │ • Bitcoin   │          │  • Contributions│
      │ • Lightning │          └─────────────────┘
      │ • Status    │
      └─────────────┘

┌──────────────────────────────────────────────────────┐
│          profile_associations (Polymorphic)          │
│  • Links ANY entity to ANY entity                    │
│  • Temporal relationships (starts_at, ends_at)       │
│  • Version tracking                                  │
│  • Visibility levels                                 │
└──────────────────────────────────────────────────────┘

        ┌──────────┐           ┌───────────────┐
        │ follows  │           │ notifications │
        │          │           │               │
        │ • Social │           │ • Multi-type  │
        │ • Counts │           │ • Unread idx  │
        └──────────┘           └───────────────┘
```

## Core Tables

### 1. User & Identity

#### **profiles** (40+ fields)

The central user entity, created automatically on signup.

**Categories of fields:**

- **Identity**: username, name, bio, avatar_url, banner_url
- **Bitcoin**: bitcoin_address, lightning_address, balances, node_id
- **Social**: follower_count, following_count, profile_views
- **Verification**: is_verified, verification_type, verified_at
- **Settings**: preferences, visibility, notifications (JSONB)
- **Metadata**: created_at, updated_at, last_active_at

**Key features:**

- Auto-created on signup via `handle_new_user()` trigger
- Username must be unique (3-30 chars, alphanumeric + `_-`)
- GIN trigram index for fuzzy username search
- RLS: Public read, owner update

### 2. Crowdfunding

#### **funding_pages**

Individual crowdfunding projects.

**Fields:**

- Basic: title, description, slug
- Financial: goal_amount, current_amount (numeric 20,8)
- Bitcoin: bitcoin_address, lightning_address
- Status: draft, active, completed, cancelled
- Media: images, video_url (JSONB array)
- Analytics: view_count, unique_donors

**Key features:**

- Belongs to profile or organization
- Bitcoin precision for all amounts
- Transparent fund tracking
- RLS: Public read, owner/org-admin update

#### **transactions**

All Bitcoin/Lightning payments.

**Fields:**

- amount (numeric 20,8)
- type: 'donation', 'pledge', 'withdrawal', 'refund'
- method: 'bitcoin_onchain', 'lightning_invoice', 'lightning_address'
- status: 'pending', 'processing', 'completed', 'failed'
- blockchain_tx_id, invoice_id
- metadata (JSONB) - flexible data storage

**Key features:**

- Immutable record (no updates after completion)
- Links to funding_page_id
- ⚠️ **Needs partitioning** as volume grows
- ⚠️ **Missing index** on status (being added)

### 3. Organizations

#### **organizations**

Multi-user entities (non-profits, DAOs, businesses).

**Fields:**

- Basic: name, description, slug, org_type
- Bitcoin: treasury_address
- Governance: governance_model (ENUM), voting_threshold
- Settings: application_required, auto_approve_threshold
- Metadata: permissions, settings (JSONB)

**Types:**

```sql
CREATE TYPE organization_type_enum AS ENUM (
  'non_profit', 'business', 'dao',
  'community', 'foundation', 'other'
)
```

#### **memberships**

Links profiles to organizations with roles.

**Roles hierarchy:**

```sql
CREATE TYPE membership_role_enum AS ENUM (
  'owner',      -- Full control
  'admin',      -- Manage members, content
  'moderator',  -- Moderate content
  'member',     -- Basic access
  'guest'       -- Limited access
)
```

**Features:**

- contribution_address per member
- total_contributions tracking
- reward_percentage (revenue sharing)
- RLS: Role-based access control

### 4. Relationships & Social

#### **profile_associations** ⭐ Exceptional Design

The star of the schema - polymorphic associations.

**Why this is brilliant:**

```sql
-- One table handles ALL relationships
source_profile_id → target_entity_id + target_entity_type

-- Examples:
• Profile "created" Campaign
• Profile "founded" Organization
• Profile "supports" Project
• Profile "collaborates" Profile
• Organization "sponsors" Campaign
```

**Advanced features:**

- **Temporal**: starts_at, ends_at (time-bound relationships)
- **Versioning**: version column for change tracking
- **Visibility**: public, members_only, private, confidential
- **Audit**: created_by, last_modified_by
- **Revenue**: reward_percentage for profit sharing

**Unique constraint:**

```sql
UNIQUE(source_profile_id, target_entity_id, relationship_type, target_entity_type)
```

Prevents duplicate relationships.

#### **follows**

Simple social following (like Twitter).

**Features:**

- Prevents self-following via CHECK constraint
- Triggers update denormalized counters on profiles
- Indexed on both follower_id and following_id

#### **notifications**

Multi-type notification system.

**Types:**

- follow, mention, comment, donation
- project_milestone, organization_invite
- system_announcement

**Optimization:**

- Partial index: `WHERE is_read = false` (only unread)
- Auto-cleanup: Could archive old notifications

### 5. Transparency & Trust

#### **transparency_scores**

Trust metrics for entities.

**Scored categories:**

- financial_transparency
- impact_reporting
- community_engagement
- governance_clarity

**Features:**

- Links to any entity (polymorphic)
- Detailed breakdown in JSONB
- Historical tracking

#### **organization_application_questions**

Dynamic forms for org membership.

**Why JSONB:**

```sql
question_data jsonb -- Flexible question types:
{
  "type": "text" | "choice" | "rating" | "file",
  "options": [...],
  "validation": {...}
}
```

Allows custom applications per organization.

## Design Patterns Explained

### 1. Polymorphic Associations

**Problem:** How to link different entity types without explosion of join tables?

**Solution:** Generic association table with type discriminator

```sql
target_entity_type text  -- 'profile', 'project', 'organization'
target_entity_id uuid    -- The actual entity's ID
```

**Benefits:**

- One table instead of N² join tables
- Easy to add new entity types
- Queryable with simple WHERE clauses

### 2. Denormalized Counters

**Problem:** `COUNT(*)` queries are slow on large tables.

**Solution:** Store counts on parent record, update via triggers

```sql
-- On profiles table
follower_count integer DEFAULT 0

-- Trigger on follows table
UPDATE profiles
SET follower_count = follower_count + 1
WHERE id = NEW.following_id
```

**Trade-off:** Slight write overhead for massive read performance.

### 3. Bitcoin Precision

**Problem:** JavaScript numbers lose precision with Bitcoin amounts.

**Solution:** PostgreSQL `numeric(20,8)` type

- 20 total digits
- 8 decimal places (satoshi precision)
- Max: 21,000,000 BTC (Bitcoin's max supply)

**Always use:** String or BigInt in JavaScript, numeric in DB.

### 4. JSONB for Flexibility

**Problem:** Schema changes require migrations and downtime.

**Solution:** JSONB fields for extensible data

```sql
settings jsonb DEFAULT '{}'::jsonb
metadata jsonb DEFAULT '{}'::jsonb
permissions jsonb DEFAULT '{}'::jsonb
```

**When to use:**

- ✅ Configuration that changes often
- ✅ User preferences
- ✅ Feature flags
- ❌ Queryable/indexed data (use columns)

### 5. Temporal Data

**Problem:** Relationships change over time.

**Solution:** starts_at, ends_at timestamps

```sql
-- "Alice worked at OrangeCat from Jan-June 2025"
starts_at: '2025-01-01'
ends_at: '2025-06-30'

-- Query current associations
WHERE NOW() BETWEEN starts_at AND COALESCE(ends_at, 'infinity')
```

## Data Flow Examples

### User Signup Flow

```sql
1. User signs up → Supabase Auth creates auth.users record
2. Trigger fires → handle_new_user()
3. Function inserts into profiles:
   - id = auth.uid()
   - username from email or metadata
   - name with smart fallbacks (standardized from display_name)
4. Profile ready for use
```

### Donation Flow

```sql
1. User donates to project
2. INSERT into transactions:
   - funding_page_id
   - amount (numeric)
   - method: 'lightning_invoice'
   - status: 'pending'
3. Lightning invoice created (external)
4. On payment: UPDATE status = 'completed'
5. UPDATE funding_pages SET current_amount += amount
6. INSERT notification for project owner
```

### Follow Flow

```sql
1. User A follows User B
2. INSERT into follows (follower_id, following_id)
3. Trigger update_follow_counts() fires:
   - UPDATE profiles SET following_count += 1 WHERE id = A
   - UPDATE profiles SET follower_count += 1 WHERE id = B
4. INSERT notification for User B
```

## Performance Characteristics

### Read-Heavy Tables

- **profiles**: Heavy reads, GIN trigram + follower_count indexes
- **funding_pages**: Heavy reads, partial indexes on status
- **follows**: Read-heavy, indexed both directions

### Write-Heavy Tables

- **transactions**: High write volume → **needs partitioning**
- **notifications**: High write → partial index on unread only

### Hot Queries

```sql
-- Profile search (GIN trigram)
SELECT * FROM profiles
WHERE username ILIKE '%orange%'

-- Active projects (partial index)
SELECT * FROM funding_pages
WHERE status = 'active'

-- Unread notifications (partial index)
SELECT * FROM notifications
WHERE user_id = ? AND is_read = false
```

## Security Model

### Row Level Security (RLS)

**Every table has policies:**

1. **Public read**: Profiles, projects (non-sensitive data)
2. **Owner write**: Users can only modify their own records
3. **Role-based**: Org admins can manage org data
4. **Conditional**: Associations respect visibility settings

### SECURITY DEFINER Functions

Used when users need elevated privileges:

```sql
-- Users can't directly update other profiles
-- But increment_profile_views() can (for analytics)
CREATE FUNCTION increment_profile_views()
SECURITY DEFINER  -- Runs as creator, not caller
```

**When to use:**

- Cross-user updates (like view counts)
- Complex business logic
- Audit trail insertion

**Security checklist:**

- ✅ Validate all inputs
- ✅ Limit scope (WHERE clauses)
- ✅ Log usage
- ❌ Never trust user input

## Migration Strategy

### Current State

- All migrations in `/supabase/migrations/`
- Applied in order by timestamp
- Production is at: `20251013072134_fix_profiles_complete.sql`

### Best Practices

1. **Never modify existing migrations** - Create new ones
2. **Test locally first** - `supabase db reset`
3. **Backup before production** - `pg_dump` before deploy
4. **Reversible when possible** - Include DOWN migration
5. **Small, focused changes** - One logical change per migration

### Upcoming Migrations

See [Improvements Roadmap](./improvements-roadmap.md):

- Add transactions.status index
- Create audit_logs table
- Partition transactions by month
- Add materialized views for analytics

---

**Next Steps:**

- [Security Policies →](./security-policies.md) - Deep dive into RLS
- [Performance →](./performance.md) - Indexing strategies
- [Functions & Triggers →](./functions-and-triggers.md) - Business logic
