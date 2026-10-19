# Group Relationships Architecture: Multi-Dimensional Model

**Created:** 2025-12-30  
**Purpose:** Comprehensive architecture for different types of group relationships (ownership, membership, employment, contracts)

---

## 🎯 Core Insight

**Groups are NOT all the same. Different group types have different relationship models:**

1. **Some groups are ownable** (companies can be owned by individuals or other companies)
2. **All groups have members** (people who are part of the group)
3. **Some groups have employees/contractors** (contractual relationships)
4. **Groups can contract with other groups** (company hiring another company)

---

## 📐 Multi-Dimensional Relationship Model

### Relationship Types

**1. Ownership** (Some Groups)
- **Who:** Companies, some business entities
- **What:** Group is owned by individual or another group
- **How:** Via `owner_actor_id` on groups table
- **Example:** "OrangeCat Inc." owned by individual or "Parent Corp"

**2. Membership** (All Groups)
- **Who:** All groups
- **What:** People who are part of the group
- **How:** Via `group_members` table
- **Example:** Members of a DAO, family members, company employees (as members)

**3. Employment/Contract** (Some Groups)
- **Who:** Companies, businesses
- **What:** Contractual relationships (employees, contractors)
- **How:** Via `group_contracts` or `group_employment` table
- **Example:** Company hiring individual or another company as contractor

**4. Group-to-Group Contracts** (Business Groups)
- **Who:** Companies, businesses
- **What:** One group contracts with another group
- **How:** Via `group_contracts` table (both parties are groups)
- **Example:** "OrangeCat Inc." hiring "Web Design Co." for web design

---

## 🏗️ Database Schema Design

### Groups Table (Enhanced)

```sql
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  label text NOT NULL DEFAULT 'circle', -- circle, family, dao, company, etc.
  
  -- Ownership (for ownable groups like companies)
  owner_actor_id uuid REFERENCES actors(id) ON DELETE SET NULL,
  -- NULL = not owned (community groups, families)
  -- Set = owned by individual or another group
  
  -- ... existing fields (governance, visibility, etc.)
);
```

**Key Point:** `owner_actor_id` is optional - only set for ownable groups.

### Group Members (Existing)

```sql
CREATE TABLE group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('founder', 'admin', 'member')),
  -- ... existing fields
);
```

**Purpose:** All groups have members (people who are part of the group).

### Group Contracts (New)

```sql
CREATE TABLE group_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Contract parties (both can be individuals or groups)
  contractor_actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  -- Individual or group providing service
  
  client_actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  -- Individual or group receiving service
  
  -- Contract details
  contract_type text NOT NULL CHECK (contract_type IN ('employment', 'contractor', 'service', 'partnership')),
  title text NOT NULL,
  description text,
  
  -- Terms
  start_date timestamptz,
  end_date timestamptz,
  compensation_type text CHECK (compensation_type IN ('salary', 'hourly', 'project', 'equity', 'other')),
  compensation_amount decimal(20,8),
  compensation_currency text DEFAULT 'BTC',
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'terminated', 'cancelled')),
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CHECK (contractor_actor_id != client_actor_id)
);
```

**Purpose:** Handles all contractual relationships:
- Individual → Group (employee/contractor)
- Group → Individual (group hiring person)
- Group → Group (company hiring company)

---

## 🎨 Group Type Classification

### Ownable Groups (Can Be Owned)

**These groups can be owned by individuals or other groups:**

1. **company** - Business organization
   - Can be owned by individual (founder/owner)
   - Can be owned by another company (subsidiary)
   - Has employees/contractors
   - Can contract with other groups

2. **cooperative** - Member-owned organization
   - Can be owned by members (via shares)
   - Has employees/contractors
   - Can contract with other groups

**Characteristics:**
- `owner_actor_id` can be set
- Can have employment/contract relationships
- Can contract with other groups

### Non-Ownable Groups (Containers Only)

**These groups are containers/organizers, not ownable:**

1. **circle** - Informal group
2. **family** - Private family group
3. **dao** - Decentralized organization
4. **nonprofit** - Mission-driven organization
5. **guild** - Professional association
6. **network_state** - Digital-first nation
7. **building** - Residential building community

**Characteristics:**
- `owner_actor_id` is NULL
- Have members (not owners)
- May have employment/contract relationships (if business-oriented)
- Cannot be owned

---

## 🔧 Implementation: Ownership System (Revised)

### Ownable Groups

**File:** `src/services/ownership/types.ts`

```typescript
/**
 * Group labels that can be owned
 */
export const OWNABLE_GROUP_LABELS = [
  'company',
  'cooperative',
] as const;

export type OwnableGroupLabel = typeof OWNABLE_GROUP_LABELS[number];

/**
 * Check if a group label is ownable
 */
export function isOwnableGroup(label: GroupLabel): label is OwnableGroupLabel {
  return OWNABLE_GROUP_LABELS.includes(label as OwnableGroupLabel);
}
```

### Group Ownership Association

**File:** `src/services/ownership/group-association.ts`

```typescript
/**
 * Associate a group with an owner (individual or another group)
 * Only works for ownable groups (companies, cooperatives)
 */
export async function associateGroupWithOwner(
  groupId: string,
  ownerActorId: string,
  userId: string
): Promise<AssociationResult> {
  // 1. Get group
  const group = await getGroup(groupId);
  
  // 2. Check if group is ownable
  if (!isOwnableGroup(group.label)) {
    return {
      success: false,
      message: `Groups with label "${group.label}" cannot be owned`,
    };
  }
  
  // 3. Check permissions (user must be founder/admin of group)
  const permission = await checkGroupPermission(
    groupId,
    userId,
    'manage_settings'
  );
  
  if (!permission.allowed) {
    return {
      success: false,
      message: 'Not authorized to transfer group ownership',
    };
  }
  
  // 4. Check governance (if hierarchical, direct; else proposal)
  const governance = GOVERNANCE_PRESETS[group.governance_preset];
  
  if (governance.id === 'hierarchical' && permission.allowed) {
    // Direct assignment
    await supabase
      .from('groups')
      .update({ owner_actor_id: ownerActorId })
      .eq('id', groupId);
    
    return {
      success: true,
      method: 'direct',
      message: 'Group ownership transferred',
    };
  } else {
    // Create proposal
    const proposal = await createProposal({
      group_id: groupId,
      proposer_id: userId,
      title: `Transfer ownership to ${ownerActorId}`,
      action_type: 'transfer_group_ownership',
      action_data: {
        new_owner_actor_id: ownerActorId,
      },
    });
    
    return {
      success: true,
      method: 'proposal',
      proposalId: proposal.id,
      message: 'Proposal created for ownership transfer',
    };
  }
}
```

---

## 🔄 Contract System

### Creating Contracts

**File:** `src/services/groups/contracts.ts`

```typescript
/**
 * Create a contract between two actors (individuals or groups)
 */
export async function createContract(
  input: {
    contractorActorId: string; // Individual or group providing service
    clientActorId: string; // Individual or group receiving service
    contractType: 'employment' | 'contractor' | 'service' | 'partnership';
    title: string;
    description?: string;
    compensationType: 'salary' | 'hourly' | 'project' | 'equity' | 'other';
    compensationAmount?: number;
    startDate?: Date;
    endDate?: Date;
    createdBy: string;
  }
): Promise<Contract> {
  // 1. Validate actors exist
  const contractor = await getActor(input.contractorActorId);
  const client = await getActor(input.clientActorId);
  
  if (!contractor || !client) {
    throw new Error('Invalid actor');
  }
  
  // 2. Check permissions
  // If contractor is a group, check if user is admin
  if (contractor.actor_type === 'group') {
    const isAdmin = await checkGroupPermission(
      contractor.group_id!,
      input.createdBy,
      'manage_settings'
    );
    if (!isAdmin.allowed) {
      throw new Error('Not authorized to create contract on behalf of group');
    }
  }
  
  // If client is a group, check if user is admin
  if (client.actor_type === 'group') {
    const isAdmin = await checkGroupPermission(
      client.group_id!,
      input.createdBy,
      'manage_settings'
    );
    if (!isAdmin.allowed) {
      throw new Error('Not authorized to create contract on behalf of group');
    }
  }
  
  // 3. Create contract
  const { data, error } = await supabase
    .from('group_contracts')
    .insert({
      contractor_actor_id: input.contractorActorId,
      client_actor_id: input.clientActorId,
      contract_type: input.contractType,
      title: input.title,
      description: input.description,
      compensation_type: input.compensationType,
      compensation_amount: input.compensationAmount,
      start_date: input.startDate,
      end_date: input.endDate,
      created_by: input.createdBy,
    })
    .select()
    .single();
  
  if (error) {
    throw error;
  }
  
  return data;
}
```

### Example: Company Hiring Another Company

```typescript
// OrangeCat Inc. (company group) hiring Web Design Co. (company group)
const contract = await createContract({
  contractorActorId: webDesignCoActor.id, // Group actor
  clientActorId: orangeCatActor.id, // Group actor
  contractType: 'service',
  title: 'Website Redesign Project',
  description: 'Complete website redesign and development',
  compensationType: 'project',
  compensationAmount: 50000, // 50k sats
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-03-31'),
  createdBy: userId, // Admin of OrangeCat Inc.
});
```

---

## 📊 Relationship Matrix

| Relationship Type | Individual → Group | Group → Individual | Group → Group |
|------------------|-------------------|-------------------|---------------|
| **Ownership** | ✅ (if ownable group) | ❌ | ✅ (if ownable group) |
| **Membership** | ✅ (all groups) | ❌ | ❌ |
| **Employment** | ✅ (if business group) | ✅ (if business group) | ✅ (if business group) |
| **Contract** | ✅ (if business group) | ✅ (if business group) | ✅ (if business group) |

---

## 🎯 User Journeys

### Journey 1: Company Owned by Individual

```
Individual creates company group
  ↓
Company has owner_actor_id = individual's actor_id
  ↓
Company can own entities (via actor_id)
  ↓
Company can have employees/contractors
  ↓
Company can contract with other groups
```

### Journey 2: Company Hiring Another Company

```
OrangeCat Inc. (company) needs web design
  ↓
Admin creates contract
  ↓
Selects "Web Design Co." (another company) as contractor
  ↓
Sets contract terms (project-based, 50k sats)
  ↓
Contract created
  ↓
Both companies can track contract status
```

### Journey 3: Company Owned by Another Company

```
Parent Corp (company) wants to own Subsidiary Inc.
  ↓
Parent Corp admin creates proposal
  ↓
Subsidiary Inc. members vote
  ↓
If passes → Subsidiary Inc. owner_actor_id = Parent Corp's actor_id
  ↓
Subsidiary Inc. is now owned by Parent Corp
```

---

## 🔍 Expert Panel Analysis

### Systems Design Expert

**Recommendation:**
> "This is a multi-dimensional relationship model. Groups need to support:
> 1. Ownership (some groups are ownable)
> 2. Membership (all groups have members)
> 3. Contracts (business relationships)
> 
> The key is distinguishing between ownable groups (companies) and non-ownable groups (communities). Use `owner_actor_id` on groups table, but only for ownable group labels."

**Key Points:**
- Multi-dimensional relationships
- Ownable vs non-ownable groups
- Contract system for business relationships
- Clear separation of concerns

### Business Logic Expert

**Recommendation:**
> "Companies are legal entities that can be owned. Communities are not. The system should:
> 1. Allow companies to be owned (via owner_actor_id)
> 2. Support employment/contract relationships (via group_contracts)
> 3. Support group-to-group contracts (company hiring company)
> 4. Keep membership separate from ownership/employment"

**Key Points:**
- Companies are ownable legal entities
- Contracts are separate from membership
- Group-to-group contracts are essential
- Clear business logic separation

### Database Design Expert

**Recommendation:**
> "Use optional `owner_actor_id` on groups table. Only set for ownable groups. Create separate `group_contracts` table for all contractual relationships (employment, contractor, service, partnership). This keeps ownership, membership, and contracts as separate concerns."

**Key Points:**
- Optional ownership field
- Separate contracts table
- Clear data model
- Efficient queries

### UX Design Expert

**Recommendation:**
> "Users need clear distinction:
> - 'I own this company' (ownership)
> - 'I'm a member of this group' (membership)
> - 'I work for this company' (employment/contract)
> 
> The UI should make these relationships clear and allow users to manage each type separately."

**Key Points:**
- Clear relationship types in UI
- Separate management interfaces
- Intuitive user experience
- Clear mental model

---

## ✅ Final Architecture

### Groups Table (Enhanced)

```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS owner_actor_id uuid REFERENCES actors(id) ON DELETE SET NULL;
```

**Purpose:** 
- NULL = non-ownable group (community, family, DAO)
- Set = ownable group (company, cooperative) owned by individual or another group

### Group Contracts Table (New)

```sql
CREATE TABLE group_contracts (
  -- ... as defined above
);
```

**Purpose:**
- All contractual relationships (employment, contractor, service, partnership)
- Works for individual → group, group → individual, group → group

### Relationship Types

1. **Ownership** (via `owner_actor_id`)
   - Only for ownable groups (company, cooperative)
   - Can be individual or another group

2. **Membership** (via `group_members`)
   - All groups have members
   - Separate from ownership/employment

3. **Contracts** (via `group_contracts`)
   - Employment, contractor, service, partnership
   - Works for all actor combinations

---

## 📋 Implementation Checklist

### Phase 1: Database Schema

- [ ] Add `owner_actor_id` to groups table
- [ ] Create `group_contracts` table
- [ ] Add indexes for performance
- [ ] Add RLS policies

### Phase 2: Type System

- [ ] Define `OwnableGroupLabel` type
- [ ] Create `isOwnableGroup()` helper
- [ ] Update group types

### Phase 3: Services

- [ ] Group ownership association service
- [ ] Contract creation service
- [ ] Contract query service
- [ ] Permission checks

### Phase 4: API Routes

- [ ] `POST /api/groups/[id]/ownership` - Transfer ownership
- [ ] `POST /api/groups/[id]/contracts` - Create contract
- [ ] `GET /api/groups/[id]/contracts` - List contracts

### Phase 5: UI Components

- [ ] Group ownership settings
- [ ] Contract creation form
- [ ] Contract list view
- [ ] Relationship indicators

---

## 🎯 Summary

**Multi-dimensional relationship model:**

1. **Ownership** (some groups)
   - Companies, cooperatives can be owned
   - Via `owner_actor_id` on groups table
   - Can be individual or another group

2. **Membership** (all groups)
   - All groups have members
   - Via `group_members` table
   - Separate from ownership/employment

3. **Contracts** (business groups)
   - Employment, contractor, service, partnership
   - Via `group_contracts` table
   - Works for individual ↔ group, group ↔ group

**Key Insight:**
- Not all groups are the same
- Companies are ownable entities
- Communities are containers
- Contracts are separate from membership/ownership

---

**Last Updated:** 2025-12-30

