# Unified Entity Ownership System

**Created:** 2025-12-30  
**Purpose:** Design unified system for associating ANY entity with groups (during creation or after)

---

## 🎯 Core Requirements

1. **During Creation:** Any entity can be associated with a group
2. **After Creation:** Existing entities can be transferred to a group
3. **Governance-Aware:** Process depends on group's governance preset
   - **Hierarchical:** Admin/Founder can directly assign
   - **Democratic:** Proposal + vote required
   - **Consensus:** Proposal + unanimous vote required

---

## 📋 Entity Registry: Single Source of Truth

**All entity types are defined in:** `src/config/entity-registry.ts`

### Architectural Distinction: Groups vs Entities

**⚠️ Important:** Groups are NOT entities in the ownership sense. Groups are containers/organizers that can OWN entities, but groups themselves are not "owned."

**See:** `docs/architecture/GROUPS_VS_ENTITIES_ARCHITECTURE.md` for full analysis.

### Ownable Entities (Can Be Associated with Groups)

**These entities can be associated with groups via the ownership system:**

1. **project** - Crowdfunded initiatives ✅
2. **product** - Physical or digital products for sale ✅
3. **service** - Professional services ✅
4. **cause** - Charitable causes ✅
5. **asset** - Valuable assets for collateral ✅
6. **loan** - Peer-to-peer Bitcoin loans ✅
7. **event** - In-person gatherings and meetups ✅
8. **ai_assistant** - Autonomous AI services ✅

### Special Cases (Excluded from Ownership System)

**1. Groups** - Groups are containers/organizers, not ownable entities
- Groups have `actor_id` to OWN other entities
- Groups are created/joined, not owned/transferred
- Groups are the mechanism, not the target

**2. Wallets** - Wallets are connections/interfaces, not assets
- Wallets are associated with entities (not owned by groups)
- Wallets are connected/disconnected, not owned

**Note:** Groups and wallets are in the entity registry for UI purposes (create menu, navigation), but are excluded from the ownership association system.

### Adding New Ownable Entity Types

**To add a new ownable entity type:**

1. **Add to `ENTITY_TYPES` array** (line 29-40)
2. **Add metadata to `ENTITY_REGISTRY`** (line 92-260)
3. **Create entity config** (optional, if using EntityForm)
4. **Add to `OWNABLE_ENTITY_TYPES`** in ownership service
5. **Done!** The ownership system automatically works for it

**Note:** If adding a container/organizer (like groups), exclude it from the ownership system but keep it in the registry for UI purposes.

**Example:**
```typescript
// In entity-registry.ts
export const ENTITY_TYPES = [
  // ... existing types
  'new_entity_type',  // Add here
] as const;

export const ENTITY_REGISTRY: Record<EntityType, EntityMetadata> = {
  // ... existing entities
  new_entity_type: {
    type: 'new_entity_type',
    name: 'New Entity',
    namePlural: 'New Entities',
    tableName: 'new_entities',
    icon: SomeIcon,
    // ... rest of metadata
  },
};
```

**That's it!** The ownership system will automatically:
- ✅ Support association during creation
- ✅ Support transfer after creation
- ✅ Work with governance-aware routing
- ✅ Work with proposals system

---

## 🏗️ Architecture: Unified Ownership Model

### Current State

**✅ Infrastructure Exists:**
- All entities have `actor_id` column (unified ownership)
- Actor system supports users and groups
- Groups have governance presets

**❌ Missing:**
- Generic association system
- Transfer ownership functionality
- Governance-aware routing

---

## 📐 Design: Generic Entity Association

### Core Concept

**Single, reusable system for ALL entity types:**

```
Entity Association Request
  ↓
Check Group Governance
  ├─ Hierarchical → Direct Assignment (if admin/founder)
  ├─ Democratic → Create Proposal → Vote
  └─ Consensus → Create Proposal → Unanimous Vote
  ↓
If Approved → Update Entity Ownership
  ├─ Set actor_id to group's actor_id
  ├─ Set group_id (if entity has it)
  └─ Update ownership metadata
```

---

## 🔧 Implementation: Generic Association Service

### File Structure

```
src/services/ownership/
├── association.ts      # Generic association logic
├── transfer.ts        # Ownership transfer
└── types.ts           # Shared types
```

### Core Service: Entity Association

**File:** `src/services/ownership/association.ts`

```typescript
/**
 * Generic entity association service
 * Works for ownable entity types (excludes groups and wallets)
 * 
 * Supported entities:
 * - project, product, service, cause, ai_assistant
 * - asset, loan, event
 * - ... and any future ownable entities
 * 
 * Excluded:
 * - group (groups are containers, not ownable)
 * - wallet (wallets are connections, not assets)
 */

import type { EntityType } from '@/config/entity-registry';
import { getTableName } from '@/config/entity-registry';

/**
 * Ownable entity types - excludes groups and wallets
 * Groups are containers/organizers, not ownable entities
 * Wallets are connections/interfaces, not assets
 */
export type OwnableEntityType = Exclude<EntityType, 'group' | 'wallet'>;
import { getActorByGroup } from '@/services/actors';
import { checkGroupPermission } from '@/services/groups/permissions';
import { isGroupMember } from '@/services/groups/utils/helpers';
import { GOVERNANCE_PRESETS } from '@/config/governance-presets';

export interface AssociateEntityRequest {
  entityType: OwnableEntityType; // Excludes 'group' | 'wallet'
  entityId: string;
  groupId: string;
  userId: string;
}

export interface AssociationResult {
  success: boolean;
  method: 'direct' | 'proposal';
  proposalId?: string;
  message: string;
}

/**
 * Associate an entity with a group
 * 
 * This is a generic function that works for ANY entity type.
 * It checks governance and routes accordingly:
 * - Hierarchical: Direct assignment (if admin/founder)
 * - Democratic/Consensus: Create proposal
 */
export async function associateEntityWithGroup(
  request: AssociateEntityRequest
): Promise<AssociationResult> {
  const { entityType, entityId, groupId, userId } = request;
  
  // 1. Auth: Check if user is member
  const isMember = await isGroupMember(groupId, userId);
  if (!isMember) {
    return {
      success: false,
      method: 'direct',
      message: 'You must be a member of the group',
    };
  }
  
  // 2. Get group governance preset
  const group = await getGroup(groupId);
  const governance = GOVERNANCE_PRESETS[group.governance_preset];
  
  // 3. Check permission based on governance
  const permission = await checkGroupPermission(
    groupId,
    userId,
    'manage_settings' // Or specific permission for entity association
  );
  
  // 4. Route based on governance
  if (governance.id === 'hierarchical' && permission.allowed) {
    // HIERARCHICAL: Direct assignment (admin/founder can do it)
    return await assignEntityToGroup(entityType, entityId, groupId);
  } else {
    // DEMOCRATIC/CONSENSUS: Create proposal
    return await createAssociationProposal(request);
  }
}

/**
 * Direct assignment (for hierarchical groups)
 */
async function assignEntityToGroup(
  entityType: EntityType,
  entityId: string,
  groupId: string
): Promise<AssociationResult> {
  // Get group's actor_id
  const groupActor = await getActorByGroup(groupId);
  if (!groupActor) {
    return {
      success: false,
      method: 'direct',
      message: 'Group actor not found',
    };
  }
  
  // Update entity ownership
  const tableName = getEntityTableName(entityType);
  await supabase
    .from(tableName)
    .update({
      actor_id: groupActor.id,
      group_id: groupId, // If entity has group_id column
    })
    .eq('id', entityId);
  
  return {
    success: true,
    method: 'direct',
    message: 'Entity associated with group',
  };
}

/**
 * Create proposal for association (for democratic/consensus groups)
 */
async function createAssociationProposal(
  request: AssociateEntityRequest
): Promise<AssociationResult> {
  const { entityType, entityId, groupId, userId } = request;
  
  // Get entity data
  const entity = await getEntity(entityType, entityId);
  
  // Create proposal
  const proposal = await createProposal({
    group_id: groupId,
    proposer_id: userId,
    title: `Associate ${entityType}: ${entity.title || entity.name}`,
    description: `Transfer ownership of this ${entityType} to the group`,
    proposal_type: 'governance',
    action_type: 'associate_entity',
    action_data: {
      entity_type: entityType,
      entity_id: entityId,
      current_owner: entity.actor_id,
      new_owner: groupId,
    },
    status: 'draft',
  });
  
  return {
    success: true,
    method: 'proposal',
    proposalId: proposal.id,
    message: 'Proposal created. Group will vote on this association.',
  };
}
```

---

## 🎬 User Journeys

### Journey 1: During Creation (Any Entity)

```
User creates entity (project/service/product/asset)
  ↓
Form has optional "Associate with Group" field
  ↓
User selects group (or leaves empty)
  ↓
If group selected:
  ├─ Check governance
  ├─ If hierarchical + admin → Create with group ownership
  └─ If democratic/consensus → Create proposal
  ↓
If no group:
  └─ Create with user ownership
```

### Journey 2: After Creation (Transfer Ownership)

```
User has existing entity (e.g., apartment asset)
  ↓
User creates group (e.g., building group)
  ↓
User goes to entity page
  ↓
Clicks "Associate with Group"
  ↓
Selects group
  ↓
System checks governance:
  ├─ Hierarchical + Admin → Direct transfer
  └─ Democratic/Consensus → Create proposal
  ↓
If proposal:
  └─ Group votes
  ↓
If passes → Entity ownership transferred
```

---

## 🔧 Implementation: Base Config Factory Enhancement

### Add Group Field to All Entity Configs

**File:** `src/config/entity-configs/base-config-factory.ts`

```typescript
/**
 * Common field: Group association
 * Can be added to any entity config
 */
export const commonFields = {
  // ... existing fields ...
  
  groupAssociation: (options?: {
    label?: string;
    hint?: string;
    required?: boolean;
  }): FieldConfig => ({
    name: 'group_id',
    label: options?.label ?? 'Associate with Group (Optional)',
    type: 'select',
    placeholder: 'Create for yourself, or associate with a group...',
    hint: options?.hint ?? 'If selected, group members will vote on this. If not, it\'s yours directly.',
    required: options?.required ?? false,
    options: [], // Populated dynamically
    colSpan: 2,
    showWhen: {
      // Only show if user is member of at least one group
      // Checked in component
    },
  }),
};
```

### Add to Entity Configs

**Example:** `src/config/entity-configs/project-config.ts`

```typescript
import { commonFields } from './base-config-factory';

const fieldGroups: FieldGroup[] = [
  {
    id: 'ownership',  // NEW
    title: 'Ownership',
    description: 'Create for yourself or associate with a group',
    fields: [
      commonFields.groupAssociation({
        hint: 'If you select a group, members will vote on this project proposal.',
      }),
    ],
  },
  // ... existing field groups
];
```

**Same for:**
- `service-config.ts`
- `product-config.ts`
- `asset-config.ts`
- `cause-config.ts`
- etc.

---

## 🔄 Generic API Route Handler

### Unified Association Endpoint

**File:** `src/app/api/entities/[type]/[id]/associate/route.ts`

```typescript
/**
 * Generic entity association endpoint
 * Works for ANY entity type
 * 
 * POST /api/entities/[type]/[id]/associate
 * Body: { group_id: string }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: { type: EntityType; id: string } }
) {
  const { type, id } = params;
  const body = await request.json();
  const { group_id } = body;
  
  // Get user
  const user = await getCurrentUser();
  
  // Associate entity with group
  const result = await associateEntityWithGroup({
    entityType: type,
    entityId: id,
    groupId: group_id,
    userId: user.id,
  });
  
  if (!result.success) {
    return apiError(result.message, 400);
  }
  
  if (result.method === 'direct') {
    // Direct assignment completed
    return apiSuccess({
      message: result.message,
      entity: await getEntity(type, id),
    });
  } else {
    // Proposal created
    return apiSuccess({
      message: result.message,
      proposal_id: result.proposalId,
      redirect: `/groups/${groupSlug}/proposals/${result.proposalId}`,
    });
  }
}
```

---

## 🎨 UI Component: Group Association

### Reusable Component

**File:** `src/components/ownership/GroupAssociationSelector.tsx`

```typescript
'use client';

/**
 * Generic group association selector
 * Works for any entity type
 */

interface GroupAssociationSelectorProps {
  entityType: EntityType;
  entityId?: string; // If provided, this is an existing entity
  currentGroupId?: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

export function GroupAssociationSelector({
  entityType,
  entityId,
  currentGroupId,
  onGroupSelect,
}: GroupAssociationSelectorProps) {
  const { user } = useAuth();
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadUserGroups();
  }, [user]);
  
  const loadUserGroups = async () => {
    const result = await groupsService.getUserGroups();
    if (result.success) {
      setUserGroups(result.groups || []);
    }
    setLoading(false);
  };
  
  if (loading) {
    return <Loading />;
  }
  
  if (userGroups.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        You're not a member of any groups. 
        <Link href="/groups/create">Create one</Link> to associate entities.
      </div>
    );
  }
  
  return (
    <Select
      value={currentGroupId || ''}
      onValueChange={onGroupSelect}
    >
      <SelectTrigger>
        <SelectValue placeholder="Create for yourself, or associate with a group..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Myself (Individual)</SelectItem>
        {userGroups.map(group => (
          <SelectItem key={group.id} value={group.id}>
            {group.name} ({group.label})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Integration with EntityForm

**File:** `src/components/create/EntityForm.tsx`

```typescript
// When rendering group_id field:
if (field.name === 'group_id') {
  return (
    <GroupAssociationSelector
      entityType={config.entityType}
      onGroupSelect={(groupId) => {
        handleFieldChange('group_id', groupId);
      }}
    />
  );
}
```

---

## 🔄 Transfer Existing Entity

### UI: Entity Settings Page

**File:** `src/components/entities/EntityOwnershipSettings.tsx`

```typescript
'use client';

/**
 * Component for transferring entity ownership to a group
 * Works for any entity type
 */

interface EntityOwnershipSettingsProps {
  entityType: EntityType;
  entityId: string;
  currentOwner: { type: 'user' | 'group'; id: string };
}

export function EntityOwnershipSettings({
  entityType,
  entityId,
  currentOwner,
}: EntityOwnershipSettingsProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const handleAssociate = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/entities/${entityType}/${entityId}/associate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_id: selectedGroup }),
        }
      );
      
      const result = await response.json();
      
      if (result.success) {
        if (result.proposal_id) {
          // Proposal created
          toast.success('Proposal created. Group will vote on this.');
          router.push(result.redirect);
        } else {
          // Direct assignment
          toast.success('Entity associated with group');
        }
      }
    } catch (error) {
      toast.error('Failed to associate entity');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ownership</CardTitle>
        <CardDescription>
          Transfer this {entityType} to a group
        </CardDescription>
      </CardHeader>
      <CardContent>
        <GroupAssociationSelector
          entityType={entityType}
          entityId={entityId}
          currentGroupId={currentOwner.type === 'group' ? currentOwner.id : null}
          onGroupSelect={setSelectedGroup}
        />
        <Button
          onClick={handleAssociate}
          disabled={!selectedGroup || loading}
          className="mt-4"
        >
          Associate with Group
        </Button>
      </CardContent>
    </Card>
  );
}
```

---

## 🗳️ Governance-Aware Routing

### Decision Logic

```typescript
function determineAssociationMethod(
  governance: GovernancePreset,
  userRole: GroupRole,
  permission: PermissionResult
): 'direct' | 'proposal' {
  // Hierarchical: Admin/Founder can directly assign
  if (governance.id === 'hierarchical') {
    if (userRole === 'founder' || userRole === 'admin') {
      return 'direct';
    }
  }
  
  // Democratic/Consensus: Always requires proposal
  return 'proposal';
}
```

### Action Execution: Associate Entity

**File:** `src/services/groups/execution/handlers.ts`

```typescript
/**
 * Execute "associate_entity" action
 * Called when proposal passes
 */
export async function executeAssociateEntity(
  groupId: string,
  actionData: {
    entity_type: EntityType;
    entity_id: string;
    current_owner: string | null;
    new_owner: string; // group_id
  }
): Promise<{ success: boolean; entityId: string }> {
  // Get group's actor_id
  const groupActor = await getActorByGroup(groupId);
  if (!groupActor) {
    throw new Error('Group actor not found');
  }
  
  // Get entity table name from registry
  const tableName = getTableName(actionData.entity_type);
  
  // Update entity ownership
  const { error } = await supabase
    .from(tableName)
    .update({
      actor_id: groupActor.id,
      group_id: groupId, // If entity has group_id column
    })
    .eq('id', actionData.entity_id);
  
  if (error) {
    throw error;
  }
  
  return {
    success: true,
    entityId: actionData.entity_id,
  };
}
```

---

## 📋 Implementation Plan

### Phase 1: Generic Association Service (4-6 hours)

1. **Create Ownership Service**
   - `src/services/ownership/association.ts`
   - `src/services/ownership/transfer.ts`
   - `src/services/ownership/types.ts`

2. **Governance-Aware Routing**
   - Check governance preset
   - Route to direct assignment or proposal

3. **Generic Entity Helpers**
   - `getTableName(entityType)` - From entity-registry.ts (already exists!)
   - `getEntity(entityType, entityId)` - Generic entity getter
   - `updateEntityOwnership(entityType, entityId, actorId)` - Generic updater

**Note:** `getTableName()` already exists in `entity-registry.ts` - no need to create it!

### Phase 2: Add to Entity Configs (2-3 hours)

1. **Update Base Config Factory**
   - Add `commonFields.groupAssociation()`

2. **Add to All Entity Configs**
   - `project-config.ts`
   - `service-config.ts`
   - `product-config.ts`
   - `asset-config.ts`
   - `cause-config.ts`
   - etc.

3. **Update EntityForm**
   - Load user's groups
   - Populate group selector
   - Handle group_id field

### Phase 3: API Routes (2-3 hours)

1. **Generic Association Endpoint**
   - `POST /api/entities/[type]/[id]/associate`

2. **Update Entity Creation Routes**
   - Check for `group_id` in all entity creation endpoints
   - Route to association service

### Phase 4: UI Components (3-4 hours)

1. **GroupAssociationSelector**
   - Reusable component
   - Works for any entity type

2. **EntityOwnershipSettings**
   - Transfer existing entities
   - Show current ownership
   - Allow association

3. **Integration**
   - Add to entity detail pages
   - Add to entity creation forms

### Phase 5: Proposal Integration (2-3 hours)

1. **Add Action Type**
   - `associate_entity` action type
   - Execution handler

2. **Proposal Templates**
   - Pre-fill proposal data
   - Show entity preview

**Total:** ~13-19 hours

---

## 🎯 Key Design Decisions

### 1. Generic, Not Specific

**Decision:** One system for ALL entity types, not separate systems.

**Why:**
- ✅ Maximum code reuse
- ✅ Consistent UX
- ✅ Easier to maintain
- ✅ Works for future entities

### 2. Governance-Aware

**Decision:** System respects group's governance preset.

**Why:**
- ✅ Matches real-world group behavior
- ✅ Hierarchical groups can move fast
- ✅ Democratic groups require consensus
- ✅ Flexible and extensible

### 3. During Creation + After Creation

**Decision:** Support both creation-time and post-creation association.

**Why:**
- ✅ Covers all use cases
- ✅ User can change mind later
- ✅ Supports your apartment example

### 4. Reuse Existing Infrastructure

**Decision:** Use actor_id, proposals, permissions - don't rebuild.

**Why:**
- ✅ Leverages existing systems
- ✅ Consistent with architecture
- ✅ Faster implementation

---

## 📊 Entity Support Matrix

**All entities from `entity-registry.ts` are supported:**

| Entity Type | `actor_id` | `group_id` | Association Support |
|-------------|------------|------------|---------------------|
| **wallet** | ✅ | ❌ | ❌ Excluded (wallets are connections, not assets) |
| **project** | ✅ | ✅ | ⚠️ Needs implementation |
| **product** | ✅ | ✅ | ⚠️ Needs implementation |
| **service** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) |
| **cause** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) |
| **ai_assistant** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) |
| **group** | ✅ | N/A | ❌ Excluded (groups are containers, not ownable) |
| **asset** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) |
| **loan** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) |
| **event** | ✅ | ❌ | ⚠️ Needs implementation (works via `actor_id`) ✅ |

**Key Points:**
- ✅ All ownable entities have `actor_id` (unified ownership model)
- ⚠️ Some entities have `group_id` column, some don't
- ✅ **Both work via `actor_id`** - the system doesn't require `group_id`
- ✅ **Events are fully supported** - just needs implementation
- ❌ **Groups are excluded** - groups are containers, not ownable
- ❌ **Wallets are excluded** - wallets are connections, not assets

**Note:** The `group_id` column is optional. The system primarily uses `actor_id` for ownership. Groups and wallets are excluded from the ownership association system.

---

## 🔍 Example: Apartment Asset Transfer

### Scenario

```
User has apartment asset (created individually)
  ↓
User creates building group
  ↓
User wants to transfer apartment to building group
  ↓
User goes to asset page → Settings → Ownership
  ↓
Selects "Building Group"
  ↓
System checks:
  ├─ Group governance: Consensus
  ├─ User role: Founder
  └─ Permission: create_proposal (allowed)
  ↓
Creates proposal:
  ├─ Title: "Associate asset: Apartment - 123 Main St"
  ├─ Action: associate_entity
  └─ Action data: { entity_type: 'asset', entity_id: '...' }
  ↓
Group members vote (consensus = 100% must agree)
  ↓
If passes:
  └─ Asset ownership transferred
      ├─ actor_id: building group's actor_id
      └─ group_id: building group id
```

---

## ✅ Summary

**This design provides:**

1. ✅ **Unified System** - Works for ALL entity types
2. ✅ **Governance-Aware** - Respects group's decision-making
3. ✅ **During + After Creation** - Both use cases covered
4. ✅ **Modular** - Reuses existing components and patterns
5. ✅ **Extensible** - Easy to add new entity types

**Key Insight:** 
- Same form field (`group_id`) for all entities
- Same association service for all entities
- Same UI component for all entities
- Governance determines process (direct vs proposal)

**Implementation:** ~13-19 hours following established patterns

---

**Last Updated:** 2025-12-30

