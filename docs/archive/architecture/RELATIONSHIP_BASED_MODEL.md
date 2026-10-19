# Relationship-Based Model: Simple & Modular

**Created:** 2025-12-30  
**Purpose:** Crystal clear architecture for relationships between actors (individuals and groups)

---

## 🎯 Core Principle

**Everything is a relationship. Relationships are defined by contracts. Contracts are created through proposals that are voted on.**

---

## 📐 Simple Model

### Actors (Already Exists)

**What:** Individuals and groups are both "actors"

**How:**
- Users have `actor_id` (user actor)
- Groups have `actor_id` (group actor)
- Entities have `actor_id` (points to owner actor)

**Why:** Unified model - everything is an actor

### Relationships (New)

**What:** Connections between actors

**Types:**
- **Membership** - Person is part of a group
- **Ownership** - Actor owns something (entity or group)
- **Employment** - Actor works for another actor
- **Contract** - Actor provides service to another actor
- **Partnership** - Actors collaborate

**Key Insight:** All relationships are the same - they're just contracts with different terms.

### Contracts (New)

**What:** Formal agreements that define relationships

**Structure:**
- **Parties** - Two actors (can be individual ↔ individual, individual ↔ group, group ↔ group)
- **Type** - What kind of relationship (membership, ownership, employment, service, partnership)
- **Terms** - What the relationship means (rights, responsibilities, compensation, etc.)
- **Status** - draft, proposed, active, completed, terminated

**Key Insight:** Contracts define what relationships mean. "Ownership" is just a contract type with specific terms.

### Proposals (Already Exists)

**What:** Requests to create contracts

**How:**
- Member creates proposal
- Proposal defines contract terms
- Group votes on proposal
- If passes → contract is created

**Key Insight:** Contracts are created through proposals that are voted on.

---

## 🏗️ Database Schema

### Contracts Table (New)

```sql
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Parties (both are actors - can be individual or group)
  party_a_actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  party_b_actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  
  -- Contract type (defines what the relationship means)
  contract_type text NOT NULL CHECK (contract_type IN (
    'membership',      -- Person joins group
    'ownership',       -- Actor owns entity/group
    'employment',      -- Actor works for another actor
    'service',         -- Actor provides service to another actor
    'partnership'      -- Actors collaborate
  )),
  
  -- What this contract is about
  subject_type text, -- 'entity', 'group', 'role', 'project', etc.
  subject_id uuid,   -- ID of the subject (entity_id, group_id, etc.)
  
  -- Terms (flexible JSONB - defines what the relationship means)
  terms jsonb NOT NULL DEFAULT '{}',
  -- Examples:
  -- { "role": "admin", "permissions": [...], "compensation": {...} }
  -- { "ownership_percentage": 100, "rights": [...], "responsibilities": [...] }
  -- { "job_title": "Developer", "salary": 5000, "start_date": "2025-01-01" }
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',        -- Being created
    'proposed',     -- Proposal created, waiting for vote
    'active',       -- Contract is active
    'completed',    -- Contract fulfilled
    'terminated'    -- Contract ended
  )),
  
  -- Proposal that created this contract (if created via proposal)
  proposal_id uuid REFERENCES group_proposals(id) ON DELETE SET NULL,
  
  -- Metadata
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  starts_at timestamptz,
  ends_at timestamptz,
  
  -- Constraints
  CHECK (party_a_actor_id != party_b_actor_id)
);

-- Indexes
CREATE INDEX idx_contracts_party_a ON contracts(party_a_actor_id);
CREATE INDEX idx_contracts_party_b ON contracts(party_b_actor_id);
CREATE INDEX idx_contracts_type ON contracts(contract_type);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_subject ON contracts(subject_type, subject_id) WHERE subject_id IS NOT NULL;
```

**Key Points:**
- Both parties are actors (flexible - individual or group)
- Contract type defines what the relationship means
- Terms are flexible JSONB (can define anything)
- Status tracks lifecycle
- Links to proposal if created via voting

---

## 🎨 Examples: How It Works

### Example 1: Person Joins Group (Membership)

```
User wants to join "Ossetia" group
  ↓
User creates proposal:
  ├─ contract_type: "membership"
  ├─ party_a_actor_id: user's actor_id
  ├─ party_b_actor_id: Ossetia's actor_id
  ├─ terms: { "role": "member", "permissions": [...] }
  └─ status: "proposed"
  ↓
Group votes on proposal
  ↓
If passes → Contract created:
  ├─ status: "active"
  └─ User is now member of group
```

### Example 2: Group Owns Asset (Ownership)

```
User wants to transfer apartment asset to building group
  ↓
User creates proposal:
  ├─ contract_type: "ownership"
  ├─ party_a_actor_id: building group's actor_id
  ├─ party_b_actor_id: apartment asset's actor_id (if assets are actors)
  ├─ subject_type: "asset"
  ├─ subject_id: apartment_asset_id
  ├─ terms: { "ownership_percentage": 100, "rights": [...], "responsibilities": [...] }
  └─ status: "proposed"
  ↓
Group votes on proposal
  ↓
If passes → Contract created:
  ├─ status: "active"
  └─ Asset ownership transferred to group
```

**Note:** If assets aren't actors, use `subject_id` to link to asset.

### Example 3: Company Hires Individual (Employment)

```
OrangeCat Inc. wants to hire developer
  ↓
Admin creates proposal:
  ├─ contract_type: "employment"
  ├─ party_a_actor_id: developer's actor_id
  ├─ party_b_actor_id: OrangeCat's actor_id
  ├─ terms: {
  │   "job_title": "Senior Developer",
  │   "salary": 5000,
  │   "currency": "BTC",
  │   "start_date": "2025-01-01",
  │   "responsibilities": [...]
  │ }
  └─ status: "proposed"
  ↓
Group votes on proposal
  ↓
If passes → Contract created:
  ├─ status: "active"
  └─ Developer is now employee
```

### Example 4: Company Hires Another Company (Service Contract)

```
OrangeCat Inc. wants web design from Web Design Co.
  ↓
Admin creates proposal:
  ├─ contract_type: "service"
  ├─ party_a_actor_id: Web Design Co.'s actor_id
  ├─ party_b_actor_id: OrangeCat's actor_id
  ├─ terms: {
  │   "service_type": "web_design",
  │   "project_scope": "Complete website redesign",
  │   "compensation": 50000,
  │   "currency": "SATS",
  │   "delivery_date": "2025-03-31"
  │ }
  └─ status: "proposed"
  ↓
Group votes on proposal
  ↓
If passes → Contract created:
  ├─ status: "active"
  └─ Web Design Co. is now contractor
```

### Example 5: Group Owns Another Group (Ownership)

```
Parent Corp wants to own Subsidiary Inc.
  ↓
Admin creates proposal:
  ├─ contract_type: "ownership"
  ├─ party_a_actor_id: Parent Corp's actor_id
  ├─ party_b_actor_id: Subsidiary Inc.'s actor_id
  ├─ subject_type: "group"
  ├─ subject_id: subsidiary_group_id
  ├─ terms: {
  │   "ownership_percentage": 100,
  │   "rights": ["manage", "decide", "receive_profits"],
  │   "responsibilities": ["maintain", "report"]
  │ }
  └─ status: "proposed"
  ↓
Subsidiary Inc. members vote
  ↓
If passes → Contract created:
  ├─ status: "active"
  └─ Parent Corp now owns Subsidiary Inc.
```

---

## 🔧 Implementation: Service Layer Pattern

### Contract Service

**File:** `src/services/contracts/index.ts`

```typescript
/**
 * Contract Service
 * 
 * Follows service layer pattern:
 * Auth → Permissions → Validate → Operate → Log → Return
 */

import { createServerClient } from '@/lib/supabase/server';
import { logger } from '@/utils/logger';
import { TABLES } from './constants';

export interface CreateContractInput {
  partyAActorId: string;
  partyBActorId: string;
  contractType: 'membership' | 'ownership' | 'employment' | 'service' | 'partnership';
  subjectType?: string;
  subjectId?: string;
  terms: Record<string, any>;
  createdBy: string;
}

export interface Contract {
  id: string;
  party_a_actor_id: string;
  party_b_actor_id: string;
  contract_type: string;
  subject_type?: string | null;
  subject_id?: string | null;
  terms: Record<string, any>;
  status: string;
  proposal_id?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  starts_at?: string | null;
  ends_at?: string | null;
}

/**
 * Create contract (via proposal or direct)
 * 
 * Service Layer Pattern:
 * 1. Auth - Check user is authenticated
 * 2. Permissions - Check user can create contract
 * 3. Validate - Validate input
 * 4. Operate - Create contract
 * 5. Log - Log action
 * 6. Return - Return result
 */
export async function createContract(
  input: CreateContractInput,
  userId: string
): Promise<{ success: boolean; contract?: Contract; error?: string }> {
  try {
    const supabase = await createServerClient();
    
    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // 2. Permissions - Check if user can create contract for party A
    const canCreate = await checkContractPermission(
      input.partyAActorId,
      userId,
      'create_contract'
    );
    if (!canCreate) {
      return { success: false, error: 'Not authorized to create contract' };
    }
    
    // 3. Validate
    if (input.partyAActorId === input.partyBActorId) {
      return { success: false, error: 'Parties must be different' };
    }
    
    // 4. Operate
    const { data, error } = await supabase
      .from(TABLES.contracts)
      .insert({
        party_a_actor_id: input.partyAActorId,
        party_b_actor_id: input.partyBActorId,
        contract_type: input.contractType,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        terms: input.terms,
        status: 'draft',
        created_by: userId,
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Failed to create contract', error, 'Contracts');
      return { success: false, error: error.message };
    }
    
    // 5. Log
    logger.info('Contract created', { contractId: data.id, userId }, 'Contracts');
    
    // 6. Return
    return { success: true, contract: data };
  } catch (error) {
    logger.error('Exception creating contract', error, 'Contracts');
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Create contract via proposal
 * 
 * If contract requires group approval, create proposal first
 */
export async function createContractProposal(
  input: CreateContractInput,
  groupId: string,
  userId: string
): Promise<{ success: boolean; proposalId?: string; error?: string }> {
  // 1. Create proposal
  const proposal = await createProposal({
    group_id: groupId,
    proposer_id: userId,
    title: `Create ${input.contractType} contract`,
    description: `Proposal to create contract between parties`,
    proposal_type: 'governance',
    action_type: 'create_contract',
    action_data: {
      contract_input: input,
    },
    status: 'draft',
  });
  
  return { success: true, proposalId: proposal.id };
}
```

---

## 🎯 Integration with Proposals

### Proposal Action: Create Contract

**File:** `src/services/groups/execution/handlers.ts`

```typescript
/**
 * Execute "create_contract" action
 * Called when proposal passes
 */
export async function executeCreateContract(
  groupId: string,
  actionData: {
    contract_input: CreateContractInput;
  }
): Promise<{ success: boolean; contractId: string }> {
  // Create contract from proposal
  const result = await createContract(
    actionData.contract_input,
    // Use group's actor as creator if needed
  );
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  // Link contract to proposal
  await supabase
    .from(TABLES.contracts)
    .update({ proposal_id: proposalId })
    .eq('id', result.contract!.id);
  
  return {
    success: true,
    contractId: result.contract!.id,
  };
}
```

---

## 📋 Implementation Plan

### Phase 1: Database Schema (2-3 hours)

- [ ] Create `contracts` table migration
- [ ] Add indexes
- [ ] Add RLS policies
- [ ] Test schema

### Phase 2: Service Layer (4-6 hours)

- [ ] Create `src/services/contracts/` directory
- [ ] Create `constants.ts` (table names)
- [ ] Create `types.ts` (TypeScript types)
- [ ] Create `queries/contracts.ts` (read operations)
- [ ] Create `mutations/contracts.ts` (write operations)
- [ ] Create `permissions.ts` (permission checks)
- [ ] Create `index.ts` (exports)

### Phase 3: API Routes (2-3 hours)

- [ ] `POST /api/contracts` - Create contract
- [ ] `GET /api/contracts` - List contracts
- [ ] `GET /api/contracts/[id]` - Get contract
- [ ] `PATCH /api/contracts/[id]` - Update contract
- [ ] `POST /api/contracts/[id]/terminate` - Terminate contract

### Phase 4: Proposal Integration (2-3 hours)

- [ ] Add `create_contract` action type
- [ ] Create execution handler
- [ ] Update proposal creation to support contracts
- [ ] Test proposal → contract flow

### Phase 5: UI Components (4-6 hours)

- [ ] Contract creation form
- [ ] Contract list view
- [ ] Contract detail view
- [ ] Integration with proposal system

**Total:** ~14-21 hours

---

## ✅ Key Benefits

1. **Simple Model** - Everything is a relationship defined by contracts
2. **Flexible** - Terms are JSONB, can define anything
3. **Modular** - Follows service layer pattern, SSOT, DRY
4. **Extensible** - Easy to add new contract types
5. **Governance-Aware** - Contracts created through proposals/voting
6. **Unified** - Same system for all relationship types

---

## 🎯 Summary

**The Model:**
- **Actors** - Individuals and groups (already exists)
- **Contracts** - Define relationships between actors
- **Proposals** - Create contracts through voting
- **Terms** - Flexible JSONB defines what relationships mean

**Everything is a relationship. Relationships are contracts. Contracts are created through proposals.**

**Keep it simple. Keep it modular. Follow the patterns.**

---

**Last Updated:** 2025-12-30

