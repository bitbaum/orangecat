# Groups vs Entities: Architectural Analysis

**Created:** 2025-12-30  
**Purpose:** Deep architectural analysis of the distinction between groups and entities, and how ownership should work

---

## 🎯 Core Insight (Revised)

**Groups are NOT all the same. Some groups (companies, cooperatives) CAN be owned by individuals or other groups. Other groups (communities, families, DAOs) are containers/organizers that cannot be owned.**

**See:** `docs/architecture/GROUP_RELATIONSHIPS_ARCHITECTURE.md` for comprehensive multi-dimensional relationship model.

---

## 📐 Architectural Distinction

### Groups: Two Categories

**1. Ownable Groups (Companies, Cooperatives)**
- **Can be owned** - By individuals or other groups (via `owner_actor_id`)
- **Business entities** - Legal entities that can be owned
- **Have employees/contractors** - Contractual relationships
- **Can contract with other groups** - Business-to-business relationships

**2. Non-Ownable Groups (Communities, Families, DAOs)**
- **Containers** - Hold members, organize people
- **Organizers** - Coordinate collective action
- **Governance Systems** - Have decision-making processes
- **Owners** - Can own other entities via `actor_id`
- **NOT ownable** - Cannot be owned or transferred

**Group Lifecycle (Ownable Group - Company):**
```
Individual creates company group
  ↓
Company has owner_actor_id = individual's actor_id
  ↓
Company has members (employees, stakeholders)
  ↓
Company can own entities (via actor_id)
  ↓
Company can have employees/contractors (via contracts)
  ↓
Company can contract with other groups
```

**Group Lifecycle (Non-Ownable Group - Community):**
```
Individual creates community group
  ↓
Group has members (not owners)
  ↓
Group can own entities (via actor_id)
  ↓
Group makes decisions (proposals, voting)
  ↓
Group coordinates collective action
```

### Entities: Ownable Things

**What Entities Are:**
- **Ownable Assets** - Can be owned by individuals or groups
- **Transferable** - Can be associated with groups
- **Created by Individuals** - But can be owned by groups
- **Targets of Ownership** - The things groups own

**Entity Lifecycle:**
```
Individual creates entity
  ↓
Entity can be owned by individual (actor_id = user's actor)
  ↓
OR entity can be associated with group (actor_id = group's actor)
  ↓
If group association → governance process (direct or proposal)
  ↓
Entity ownership transferred to group
```

---

## 🏗️ Current Architecture Analysis

### Actor System (Correct)

**How it works:**
- Users have `actor_id` (user actor)
- Groups have `actor_id` (group actor)
- Entities have `actor_id` (points to user OR group actor)

**Why this is correct:**
- ✅ Groups can own entities (via their actor_id)
- ✅ Unified ownership model
- ✅ Extensible (future: AI agents as actors)

**What this means:**
- Groups use actors to OWN things
- Groups themselves are NOT owned via actors
- Groups are the mechanism, not the target

### Entity Registry (Needs Clarification)

**Current State:**
- Groups are in `entity-registry.ts`
- This is fine for UI purposes (create menu, navigation)
- But groups should NOT be in the "ownership association" system

**What Should Happen:**
- ✅ Groups stay in registry (for UI/navigation)
- ❌ Groups excluded from ownership association system
- ✅ All other entities support ownership association

---

## 🎨 Ownership System Design

### Ownable Entities (Can Be Associated with Groups)

**These entities can be associated with groups:**

1. **project** - Crowdfunded initiatives
2. **product** - Physical or digital products
3. **service** - Professional services
4. **cause** - Charitable causes
5. **asset** - Valuable assets for collateral
6. **loan** - Peer-to-peer Bitcoin loans
7. **event** - In-person gatherings and meetups
8. **ai_assistant** - Autonomous AI services

**All of these:**
- Have `actor_id` column
- Can be owned by individuals (actor_id = user actor)
- Can be owned by groups (actor_id = group actor)
- Can be transferred between owners
- Can be associated with groups (via ownership system)

### Special Cases

**1. Ownable Groups (Companies, Cooperatives)**
- **Why:** Business entities that can be owned
- **How:** Have `owner_actor_id` on groups table
- **Lifecycle:** Can be owned/transferred
- **Registry:** Yes (for UI), included in ownership system

**2. Non-Ownable Groups (Communities, Families, DAOs)**
- **Why:** Containers/organizers, not ownable entities
- **How:** Groups have `actor_id` to OWN other entities
- **Lifecycle:** Created/joined, not owned/transferred
- **Registry:** Yes (for UI), excluded from ownership system

**2. Wallets**
- **Why:** Wallets are connections/interfaces, not assets
- **How:** Wallets are associated with entities (not owned by groups)
- **Lifecycle:** Connected/disconnected, not owned
- **Registry:** Yes (for UI), but excluded from ownership system

---

## 🔧 Implementation: Ownership System

### Entity Types for Ownership Association

**File:** `src/services/ownership/types.ts`

```typescript
/**
 * Entity types that can be associated with groups
 * Excludes: 'group' (groups are containers, not ownable)
 * Excludes: 'wallet' (wallets are connections, not assets)
 */
export type OwnableEntityType = Exclude<
  EntityType,
  'group' | 'wallet'
>;

// All other entities from registry are ownable
export const OWNABLE_ENTITY_TYPES: OwnableEntityType[] = [
  'project',
  'product',
  'service',
  'cause',
  'asset',
  'loan',
  'event',
  'ai_assistant',
] as const;
```

### Association Service (Updated)

**File:** `src/services/ownership/association.ts`

```typescript
import type { OwnableEntityType } from './types';

export interface AssociateEntityRequest {
  entityType: OwnableEntityType; // NOT EntityType - excludes groups/wallets
  entityId: string;
  groupId: string;
  userId: string;
}

/**
 * Associate an ownable entity with a group
 * 
 * This function ONLY works for entities that can be owned.
 * Groups themselves cannot be associated with other groups.
 */
export async function associateEntityWithGroup(
  request: AssociateEntityRequest
): Promise<AssociationResult> {
  // ... implementation
}
```

---

## 🎯 User Experience Implications

### Creating Entities

**User Journey:**
```
User creates entity (project/service/asset/etc.)
  ↓
Form shows "Associate with Group" field
  ↓
User selects group (or leaves empty)
  ↓
If group selected:
  ├─ System creates proposal (if needed)
  └─ Group votes/approves
  ↓
Entity ownership transferred to group
```

**Groups are NOT in this flow** - groups are the target, not the entity being created.

### Transferring Ownership

**User Journey:**
```
User has entity (e.g., apartment asset)
  ↓
User goes to entity settings
  ↓
Clicks "Associate with Group"
  ↓
Selects group
  ↓
System checks governance:
  ├─ Hierarchical + Admin → Direct transfer
  └─ Democratic/Consensus → Proposal
  ↓
If approved → Entity ownership transferred
```

**Groups are NOT transferable** - groups are the mechanism, not the target.

### Group Management

**User Journey:**
```
User creates group
  ↓
Group has members (not owners)
  ↓
Group can own entities (via actor_id)
  ↓
Group makes decisions (proposals, voting)
  ↓
Group coordinates collective action
```

**Groups are containers** - they organize people and own things, but aren't themselves owned.

---

## 📊 Architecture Comparison

### ❌ Wrong: Groups as Ownable Entities

```
Group → Can be associated with another group
  ↓
Problem: Groups are containers, not assets
  ↓
Result: Confusing UX, wrong mental model
```

### ✅ Correct: Groups as Containers

```
Group → Can own entities
  ↓
Entities → Can be associated with groups
  ↓
Result: Clear separation, correct mental model
```

---

## 🔍 Expert Panel Analysis

### Systems Design Expert

**Recommendation:**
> "Groups are clearly containers/organizers, not ownable entities. The ownership system should work FOR groups (allowing groups to own entities), not include groups as targets. This is a fundamental architectural distinction."

**Key Points:**
- Groups are the mechanism (containers)
- Entities are the targets (ownable things)
- Clear separation of concerns
- Prevents architectural confusion

### UX Design Expert

**Recommendation:**
> "Users understand that groups are communities/organizations, not things you 'own' or 'transfer.' The mental model should be: 'I create a group, the group owns things.' Not: 'I create a group, I can transfer the group to another group.'"

**Key Points:**
- Groups = communities/organizations
- Entities = things groups can own
- Clear user mental model
- Prevents confusion

### Backend Engineering Expert

**Recommendation:**
> "The actor system is correct - groups have actor_id to OWN entities. But groups themselves should NOT be in the ownership association system. Exclude groups from the association service, but keep them in the entity registry for UI purposes."

**Key Points:**
- Actor system is correct
- Groups use actors to own things
- Groups not targets of ownership
- Clear code boundaries

### Frontend Engineering Expert

**Recommendation:**
> "Keep groups in entity-registry.ts for UI (create menu, navigation), but exclude them from ownership association components. The GroupAssociationSelector should only show groups as targets, not as entities to be associated."

**Key Points:**
- Registry for UI is fine
- Exclude from association system
- Clear component boundaries
- Type-safe exclusions

---

## ✅ Final Architecture

### Entity Registry (UI/Navigation)

**Purpose:** UI components, navigation, create menu

**Includes:**
- All entities (including groups, wallets)
- Metadata for display
- Routing information

**Why:** Groups need to be in registry for UI purposes (create menu, navigation)

### Ownership System (Association)

**Purpose:** Entity-to-group association

**Includes:**
- Only ownable entities (excludes groups, wallets)
- Association logic
- Governance-aware routing

**Why:** Groups are containers, not targets of ownership

### Actor System (Ownership Model)

**Purpose:** Unified ownership model

**How:**
- Users have actors (to own entities)
- Groups have actors (to own entities)
- Entities have actor_id (points to owner)

**Why:** Groups use actors to own things, but groups themselves aren't owned

---

## 📋 Implementation Checklist

### Phase 1: Type Safety

- [ ] Create `OwnableEntityType` type (excludes 'group' | 'wallet')
- [ ] Update association service to use `OwnableEntityType`
- [ ] Update API routes to use `OwnableEntityType`
- [ ] Update UI components to use `OwnableEntityType`

### Phase 2: Documentation

- [ ] Document that groups are containers, not ownable
- [ ] Document that groups use actors to own entities
- [ ] Update entity registry docs to clarify purpose
- [ ] Update ownership system docs to exclude groups

### Phase 3: Code Updates

- [ ] Update association service to exclude groups
- [ ] Update UI components to exclude groups from association
- [ ] Add type guards to prevent group association
- [ ] Update tests to verify groups are excluded

---

## 🎯 Summary

**Groups are NOT entities in the ownership sense:**

1. **Groups are containers/organizers**
   - Hold members
   - Coordinate collective action
   - Have governance systems

2. **Groups can own entities**
   - Via actor_id system
   - Groups are the mechanism, not the target

3. **Groups should be excluded from ownership association system**
   - Keep in registry (for UI)
   - Exclude from association service
   - Clear architectural boundaries

4. **Ownable entities:**
   - project, product, service, cause, asset, loan, event, ai_assistant
   - All can be associated with groups
   - All support ownership transfer

**The architecture should reflect:**
- Groups = containers (own things)
- Entities = ownable things (can be owned by groups)
- Clear separation of concerns
- Correct mental model for users

---

**Last Updated:** 2025-12-30

