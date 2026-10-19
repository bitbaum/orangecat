# OrangeCat Platform Architecture
## Entity Relationships & Data Model

**Created:** 2025-10-13
**Last Modified:** 2025-01-20
**Status:** Stale 2025 snapshot — not a current "Production Ready" claim
**Purpose:** Define clear boundaries between entities and their relationships in the simplified MVP architecture

> Honesty pass 2026-09-03: this document's "Production Ready" status was a 2025 leftover. OrangeCat is live at orangecat.ch; do not treat this file as today's readiness gate.

> 📖 **Long-Term Vision**: See [LONG_TERM_VISION.md](./LONG_TERM_VISION.md) for the complete vision including Assets, Events, and Organizations with multi-entity associations.

---

## 🎯 Current Architecture

OrangeCat now uses a **simplified, maintainable database schema** optimized for Bitcoin crowdfunding with multi-entity transactions and full transparency.

### Core Design Philosophy
- **5 Essential Tables** (down from 10+ complex tables)
- **Unified "Projects" Entity** (consolidated from campaigns + projects)
- **Multi-Entity Transactions** (any entity can donate to any other)
- **Bitcoin-Native Design** (Lightning/Bitcoin addresses for all entities)
- **Transparency by Default** (public transaction visibility)

## 📐 Entity Definitions

### 1. **Profile** (Individual User)
**What it is:** A single person's account on the platform.

**Core Purpose:**
- Personal identity and reputation
- Individual fundraising capabilities
- Social connections and following

**Can Do:**
- Create projects (personal fundraising)
- Join organizations (become member/leader)
- Create/lead organizations
- Support other projects/organizations
- Receive Bitcoin directly

**Cannot Do:**
- Act on behalf of others without association
- Edit other profiles
- Control organizations they don't manage

**Key Fields:**
```typescript
{
  id: uuid (auth.users.id)
  username: string (unique)
  name: string  // User's display name (standardized)
  bio: string
  avatar_url: string
  bitcoin_address: string  // Personal receiving address
  lightning_address: string
  created_at: timestamp
}
```

---

### 2. **Organization** (Group Entity)
**What it is:** A collective entity managed by multiple profiles, representing a formal group.

**Core Purpose:**
- Formal group identity (nonprofits, companies, DAOs)
- Group fundraising and management
- Multi-person governance
- Shared Bitcoin treasury

**Examples:**
- "Red Cross"
- "Local Food Bank"
- "Open Source Project Foundation"

**Can Do:**
- Run multiple projects
- Have multiple members with roles
- Distribute Bitcoin rewards to members
- Create projects under their umbrella

**Cannot Do:**
- Act independently (requires member actions)
- Self-manage (needs human profiles as members)

**Key Fields:**
```typescript
{
  id: uuid
  slug: string (unique, URL-friendly)
  name: string
  description: string
  type: 'nonprofit' | 'company' | 'dao' | 'collective' | 'foundation'
  avatar_url: string
  banner_url: string
  bitcoin_address: string  // Organization treasury
  lightning_address: string
  created_by: uuid (profile.id)  // Founder
  created_at: timestamp
  verification_status: 'unverified' | 'pending' | 'verified'
}
```

**Missing Table:** `organization_members`
```sql
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'admin', 'member', 'contributor')),
  permissions jsonb DEFAULT '{}',
  joined_at timestamp DEFAULT now(),
  invited_by uuid REFERENCES profiles(id),
  status text CHECK (status IN ('active', 'pending', 'removed')),
  UNIQUE(organization_id, profile_id)
);
```

---

### 3. **Project** (Unified Fundraising Entity)
**What it is:** A flexible fundraising or collaborative initiative that can be time-bound or open-ended.

**Core Purpose:**
- Raise Bitcoin for any cause (optional goal setting)
- Track donations and progress (when applicable)
- Support both fundraising and non-fundraising projects
- Enable collaboration and community building

**Created By:**
- Individual Profile (personal project)
- Organization (organizational project)

**Examples:**
- "Bitcoin Education Center" (personal project with fundraising)
- "Lightning Network Tools" (open-source development project)
- "Community Bitcoin Meetups" (ongoing community project)

**Key Features:**
- **Optional Fundraising**: Can have goals or be open-ended
- **Timeline Planning**: Optional start/end dates for structured projects
- **Bitcoin Integration**: Lightning/Bitcoin addresses for all projects
- **Transparency**: Public transaction visibility by default

**Key Fields:**
```typescript
{
  id: uuid
  title: string
  description: string

  // Optional fundraising (nullable for non-fundraising projects)
  goal_amount: number | null (in sats)
  current_amount: number (in sats)
  currency: 'SATS' | 'BTC'

  // Ownership
  creator_id: uuid (profile.id)  // Who created it
  organization_id: uuid | null   // If org project

  // Payment (optional - only needed if accepting donations)
  bitcoin_address: string | null
  lightning_address: string | null

  // Project management
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  category: string | null
  tags: string[] | null
  start_date: timestamp | null
  target_completion: timestamp | null

  // Timestamps
  created_at: timestamp
  updated_at: timestamp
}
```

**Rule:** Campaign ownership determines edit permissions
- If `organization_id` is set: Org admins/owners can edit
- If `organization_id` is null: Only `creator_id` can edit

---

### 4. **Transaction** (Multi-Entity Payments)
**What it is:** A universal payment system supporting donations between any entities.

**Core Purpose:**
- Enable payments between any combination of profiles, organizations, and projects
- Provide complete transparency and audit trails
- Support various payment purposes (funding, tips, grants, etc.)

**Key Features:**
- **Multi-Entity Support**: Any entity can send to any other entity
- **Purpose Categorization**: funding, tips, grants, refunds, etc.
- **Transparency Control**: Public or private transactions
- **Bitcoin-Native**: Lightning and on-chain payment support

**Examples:**
- Profile → Project: Traditional crowdfunding donations
- Organization → Profile: Grant payments or tips
- Project → Organization: Refunds or shared revenue
- Organization → Project: Sponsorship or investment

**Key Fields:**
```typescript
{
  id: uuid
  amount_sats: number  // Amount in satoshis

  // Source entity
  from_entity_type: 'profile' | 'organization' | 'project'
  from_entity_id: uuid

  // Destination entity
  to_entity_type: 'profile' | 'organization' | 'project'
  to_entity_id: uuid

  // Payment details
  payment_method: 'bitcoin' | 'lightning' | 'on-chain' | 'off-chain'
  transaction_hash: string | null
  status: 'pending' | 'confirmed' | 'failed'

  // Transparency
  purpose: string | null  // funding, tip, grant, etc.
  public_visibility: boolean
  anonymous: boolean

  // Audit trail
  audit_trail: jsonb  // Detailed transaction history

  // Timestamps
  created_at: timestamp
  confirmed_at: timestamp | null
}
```

## 🔗 Entity Relationships & Permissions

The current architecture uses **simplified, direct relationships** between entities:

### Core Relationships

#### 1. **Profile → Project (Creator)**
- **Direction**: Profile creates Project
- **Permission**: Full CRUD control
- **Use Case**: Personal fundraising projects

#### 2. **Organization → Project (Owner)**
- **Direction**: Organization owns Project
- **Permission**: Organization admins can manage
- **Use Case**: Organizational fundraising initiatives

#### 3. **Profile → Organization (Membership)**
- **Direction**: Profile joins Organization
- **Permission**: Based on role (member/admin/owner)
- **Use Case**: Community participation

#### 4. **Multi-Entity Transactions**
- **Direction**: Any entity → Any entity
- **Permission**: Based on entity ownership/permissions
- **Use Case**: Donations, tips, grants, refunds

### Permission System

**Simple Role-Based Access:**
- **Profile Owner**: Can manage their own profile and created projects
- **Organization Admin**: Can manage organization and its projects
- **Transaction Participants**: Can view their own transactions

**No Complex Association Tables** - Direct foreign key relationships keep it simple and fast.

---

## 🗄️ Current Database Schema Summary

### **5 Core Tables (Simplified from 10+)**

| Table | Purpose | Key Relationships |
|-------|---------|------------------|
| `profiles` | User accounts | `auth.users` (1:1) |
| `projects` | Unified fundraising entities | `profiles` (N:1), `organizations` (N:1) |
| `transactions` | Multi-entity payments | `profiles` (N:1), `projects` (N:1), `organizations` (N:1) |
| `organizations` | Group entities | `profiles` (N:1) |
| `organization_members` | Team management | `organizations` (N:1), `profiles` (N:1) |

### **Schema Benefits**
- ✅ **Bitcoin-Native**: Lightning/Bitcoin addresses for all entities
- ✅ **Multi-Entity Transactions**: Any entity can donate to any other
- ✅ **Transparency**: Public transaction visibility and audit trails
- ✅ **Simplicity**: 5 tables instead of 10+ complex tables
- ✅ **Performance**: Proper indexing and minimal JOINs

---

## 📋 Implementation Status

### ✅ **Completed**
- **Database Migration**: Simplified schema with unified projects entity
- **Multi-Entity Transactions**: Any entity can donate to any other entity
- **TypeScript Types**: Updated for simplified schema
- **API Routes**: `/api/projects/*` and `/api/transactions/*`
- **Authentication**: Proper RLS policies and permissions

### 🚧 **In Progress**
- **Frontend Updates**: Dashboard and project creation interfaces
- **Transaction Management**: UI for creating and viewing transactions
- **Organization Management**: Enhanced org functionality

### 📋 **Next Steps**
1. **Complete Frontend Integration** - Update all components for new schema
2. **Test Multi-Entity Transactions** - Verify all donation flows work
3. **Performance Optimization** - Ensure fast queries with proper indexing
4. **Documentation Updates** - Keep all docs current with schema changes

---

## 🎯 Architecture Philosophy

### **Before (Over-engineered)**
- 10+ tables with complex relationships
- Separate campaigns and projects entities
- Overly complex permission systems
- Feature creep for "enterprise" features

### **After (MVP-Focused)**
- **5 essential tables** with clear purposes
- **Unified projects entity** for all fundraising needs
- **Multi-entity transactions** for maximum flexibility
- **Bitcoin-native design** with transparency by default

**Result**: A **maintainable, scalable foundation** for Bitcoin crowdfunding that prioritizes **user experience** over **architectural complexity**.
