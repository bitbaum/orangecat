# Building Modeling Strategy: Community vs Asset

**Created:** 2025-12-30  
**Question:** How should we model buildings that can be both a community (group) and real estate (asset)?

---

## 🎯 The Challenge

Buildings have **dual nature**:

1. **Building as Community** (Group)
   - People living together
   - Shared governance (residents decide together)
   - Shared expenses (utilities, maintenance)
   - Events (building meetings, social gatherings)
   - Private visibility (only residents see)

2. **Building as Asset** (Real Estate)
   - Physical property
   - Has monetary value
   - Can be used as collateral for loans
   - Ownership documentation
   - Location, size, features

3. **Building as Co-living/Subdivision**
   - Could be apartment complex
   - Could be subdivision
   - Could be co-living space
   - Same dual nature applies

---

## ✅ Recommended Solution: **Dual Model with Linking**

### Architecture: Building = Group Label + Asset Type + Ownership Link

```
┌─────────────────────────────────────────────────────────┐
│  BUILDING AS GROUP (Community Aspect)                  │
│  - Label: "building"                                    │
│  - Members: Residents                                  │
│  - Governance: Consensus/Democratic                     │
│  - Features: Shared wallet, events, proposals         │
│  - Visibility: Private (residents only)                │
└─────────────────────────────────────────────────────────┘
                          │
                          │ owns
                          ▼
┌─────────────────────────────────────────────────────────┐
│  BUILDING AS ASSET (Property Aspect)                    │
│  - Type: "real_estate"                                  │
│  - Owner: Building Group (via actor_id)                │
│  - Value: Estimated property value                     │
│  - Location: Physical address                           │
│  - Documents: Deeds, insurance, etc.                   │
│  - Use: Collateral for loans                           │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Implementation

### Step 1: Add "Building" as Group Label

**File:** `src/config/group-labels.ts`

```typescript
building: {
  id: 'building',
  name: 'Building',
  description: 'Residential building with shared governance',
  icon: Building,
  color: 'slate',
  defaults: {
    is_public: false,
    visibility: 'private',  // Only residents see
  },
  suggestedFeatures: ['shared_wallet', 'events', 'proposals'],
  defaultGovernance: 'consensus',  // Residents decide together
},
```

**Purpose:** Handles community aspect
- ✅ Residents as members
- ✅ Shared governance
- ✅ Building meetings (events)
- ✅ Shared expenses (treasury)
- ✅ Private visibility

### Step 2: Use Existing "Real Estate" Asset Type

**Already exists!** `src/types/asset.ts`:

```typescript
export type AssetType = 'real_estate' | 'business' | 'vehicle' | ...
```

**Purpose:** Handles property aspect
- ✅ Property value
- ✅ Location
- ✅ Documents
- ✅ Collateral for loans

### Step 3: Link via Ownership

**Architecture already supports this!**

The system has an **Actor model** where:
- Users are actors
- Groups are actors
- Actors can own entities (including assets)

**How it works:**
1. Create building as **Group** (label: "building")
2. Create building as **Asset** (type: "real_estate")
3. Set asset's `actor_id` to the building group's actor_id
4. Now the building group **owns** the building asset

---

## 📊 Use Cases

### Use Case 1: Co-living Building

**Scenario:** 20-unit apartment building with shared governance

1. **Create Building Group:**
   - Name: "Sunset Apartments"
   - Label: "building"
   - Members: All residents
   - Governance: Consensus (residents vote on decisions)
   - Features: Shared wallet, events, proposals

2. **Create Building Asset:**
   - Title: "Sunset Apartments - 123 Main St"
   - Type: "real_estate"
   - Owner: Sunset Apartments Group (via actor_id)
   - Value: $2,500,000
   - Location: "Zurich, Switzerland"
   - Documents: Property deed, insurance

3. **Link:**
   - Building group owns building asset
   - Group can use asset as collateral for loans
   - Asset value tracked separately from group treasury

### Use Case 2: Subdivision

**Scenario:** Subdivision with HOA (Homeowners Association)

1. **Create Subdivision Group:**
   - Name: "Oakwood Subdivision HOA"
   - Label: "building" (or could be "cooperative")
   - Members: All homeowners
   - Governance: Democratic (majority vote)
   - Features: Treasury, proposals, voting

2. **Create Subdivision Asset:**
   - Title: "Oakwood Subdivision - Common Areas"
   - Type: "real_estate"
   - Owner: Oakwood Subdivision HOA Group
   - Value: Common area value
   - Documents: HOA documents, land surveys

### Use Case 3: Building as Asset Only

**Scenario:** Someone owns a building but doesn't need community features

1. **Just create Asset:**
   - Title: "Investment Property - 456 Oak St"
   - Type: "real_estate"
   - Owner: Individual user (not a group)
   - Value: $500,000
   - Use: Collateral for personal loan

**No group needed!** ✅

---

## 🎯 Decision Matrix

| Scenario | Group Needed? | Asset Needed? | Link? |
|----------|---------------|---------------|-------|
| **Co-living building** | ✅ Yes (community) | ✅ Yes (property) | ✅ Yes (group owns asset) |
| **Subdivision HOA** | ✅ Yes (governance) | ✅ Yes (common areas) | ✅ Yes |
| **Investment property** | ❌ No | ✅ Yes (collateral) | ❌ No |
| **Building community** | ✅ Yes (residents) | Optional | Optional |

---

## 💡 Why This Approach?

### ✅ Advantages

1. **Follows Existing Patterns**
   - Uses existing group label system
   - Uses existing asset system
   - Uses existing actor ownership model
   - No new entity types needed

2. **Separation of Concerns**
   - Community aspect = Group
   - Property aspect = Asset
   - Clear boundaries

3. **Flexibility**
   - Building can be group only (community without property tracking)
   - Building can be asset only (property without community)
   - Building can be both (linked)

4. **Extensibility**
   - Easy to add building label (5 minutes)
   - Real estate asset type already exists
   - Ownership linking already works

5. **Real-World Accuracy**
   - Matches how buildings actually work
   - Community (residents) is separate from property (asset)
   - Community can own property

### ❌ Alternative Approaches (Why Not)

#### ❌ Building as Separate Entity Type
- **Problem:** Duplicates functionality
- **Problem:** More complex (10+ files)
- **Problem:** Doesn't leverage existing systems
- **Verdict:** Overkill

#### ❌ Building as Group Only
- **Problem:** Can't use as collateral
- **Problem:** Can't track property value separately
- **Problem:** Mixes community and property concerns
- **Verdict:** Too limited

#### ❌ Building as Asset Only
- **Problem:** No community features
- **Problem:** No governance
- **Problem:** No member management
- **Verdict:** Missing functionality

---

## 🔍 Implementation Details

### Current Asset Ownership Model

**File:** `src/types/asset.ts`

```typescript
export interface Asset {
  id: string
  owner_id: string  // Currently user_id, but could be actor_id
  type: AssetType
  // ...
}
```

**✅ Assets Already Support Group Ownership!**

The system already has `actor_id` on assets table (migration `20250130000005_add_actor_id_to_entities.sql`).

**How it works:**
1. Groups have an `actor_id` (via actors table)
2. Assets have both `owner_id` (user) and `actor_id` (user or group)
3. When a group owns an asset, set the asset's `actor_id` to the group's actor_id

**This means:** Groups can already own assets! ✅

### Linking Building Group to Building Asset

**Step 1: Get group's actor_id**
```typescript
const groupActor = await getActorByGroup(buildingGroup.id);
```

**Step 2: Create building asset with actor_id**
```typescript
const buildingAsset = {
  title: "Sunset Apartments",
  type: "real_estate",
  owner_id: buildingGroup.created_by,  // Fallback to creator
  actor_id: groupActor.id,  // Link to group via actor
  estimated_value: 2500000,
  location: "Zurich, Switzerland",
  // ...
};
```

**Query building's asset:**
```typescript
const groupActor = await getActorByGroup(buildingGroup.id);
const buildingAsset = await getAssetByActorId(groupActor.id);
```

---

## 📋 Action Items

### Immediate (Easy)
- [x] Add "building" as group label (5 minutes)
- [x] Asset ownership already supports groups (via actor_id) ✅
- [ ] Add template for building group
- [ ] Add UI helper to link building group to building asset

### Future (If Needed)
- [ ] Add `group_id` to assets table (if not already supported)
- [ ] Add UI to link building group to building asset
- [ ] Add query to get assets owned by a group
- [ ] Add building-specific guidance

---

## 🎯 Summary

**Best Approach:** **Dual Model with Linking**

1. **Building as Group Label** - Handles community aspect
2. **Building as Real Estate Asset** - Handles property aspect  
3. **Link via Ownership** - Group owns asset

**Why:**
- ✅ Uses existing systems
- ✅ Clear separation of concerns
- ✅ Flexible (can be one or both)
- ✅ Matches real-world model
- ✅ Easy to implement (mostly already done)

**Time to Implement:**
- Adding building label: **5 minutes**
- Verifying asset-group linking: **30 minutes**
- Full implementation: **1-2 hours**

---

**Last Updated:** 2025-12-30

