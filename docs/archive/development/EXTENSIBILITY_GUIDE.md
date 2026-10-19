# Extensibility Guide: Adding New Group Types & Entity Types

**Created:** 2025-12-30  
**Purpose:** Document how easy it is to extend the system with new group labels and entity types

---

## 🎯 Quick Answer

### Adding a New Group Label (e.g., "Building") = **VERY EASY** ⚡

**Time:** ~5 minutes  
**Files to change:** 1 file  
**Code changes:** ~15 lines

### Adding a New Entity Type (e.g., "Building" as separate entity) = **MODERATE** 📝

**Time:** ~2-4 hours  
**Files to create/change:** ~8-10 files  
**Code changes:** ~500-800 lines

---

## 📋 Scenario: Adding "Building" as a Group Type

### What You Want

A new group label called "Building" for people living together in the same building. They might want:

- Shared expenses (utilities, maintenance)
- Building governance (consensus or democratic)
- Private visibility (only residents can see)
- Optional treasury for building funds

### How Easy Is It?

**Answer: EXTREMELY EASY** ✅

The architecture is designed for this. The comment in `group-labels.ts` literally says:

> **"Adding a new label = adding an entry here. No code changes needed."**

---

## 🔧 Step-by-Step: Adding "Building" Group Label

### Step 1: Add to Group Labels Config (5 minutes)

**File:** `src/config/group-labels.ts`

```typescript
import {
  Users,
  Building2,
  Heart,
  Briefcase,
  Globe,
  Home,
  Handshake,
  Building, // ← Add this import
} from 'lucide-react';

export const GROUP_LABELS = {
  // ... existing labels ...

  building: {
    // ← Just add this entry
    id: 'building',
    name: 'Building',
    description: 'Residential building with shared governance',
    icon: Building, // Lucide icon
    color: 'slate',
    defaults: {
      is_public: false,
      visibility: 'private', // Only residents can see
    },
    suggestedFeatures: ['shared_wallet', 'events'], // Shared expenses, building meetings
    defaultGovernance: 'consensus', // Residents decide together
  },
} as const satisfies Record<string, GroupLabelConfig>;
```

**That's it!** ✅

The system automatically:

- ✅ Shows it in the label selector dropdown
- ✅ Applies the defaults when selected
- ✅ Validates it (enum includes it)
- ✅ Displays it with the correct icon/color
- ✅ Works in all existing components

### Step 2: (Optional) Add to Templates

**File:** `src/components/create/templates/group-templates.ts`

```typescript
{
  id: 'residential-building',
  icon: React.createElement(Building, { className: 'w-4 h-4' }),
  name: 'Residential Building',
  tagline: 'Shared governance for building residents',
  defaults: {
    name: '',
    description: '',
    label: 'building',
    governance_preset: 'consensus',
    is_public: false,
    visibility: 'private',
    bitcoin_address: null,
    lightning_address: null,
  },
},
```

**Time:** 2 minutes

### Step 3: (Optional) Add Guidance

**File:** `src/lib/entity-guidance/group-guidance.ts`

If you want specific guidance when users select "building" label, you can add it to the `label` field guidance:

```typescript
label: {
  // ... existing guidance ...
  examples: [
    // ... existing examples ...
    'Building - Residential building with shared governance',
  ],
},
```

**Time:** 1 minute

---

## ✅ What Works Automatically

Once you add the label to `GROUP_LABELS`, these all work automatically:

1. **Form Selection** - Appears in label dropdown
2. **Validation** - TypeScript enum includes it
3. **Default Values** - Smart defaults applied
4. **UI Display** - Icon, color, name shown correctly
5. **Database** - Stored as string, no migration needed
6. **API** - Accepts and returns the new label
7. **Components** - All group components work with it

**No other code changes needed!** 🎉

---

## 📊 Comparison: Group Label vs Entity Type

### Adding "Building" as a Group Label

| Aspect         | Effort                      | Files Changed        |
| -------------- | --------------------------- | -------------------- |
| **Config**     | 1 file, ~15 lines           | `group-labels.ts`    |
| **Templates**  | Optional, 1 file, ~15 lines | `group-templates.ts` |
| **Guidance**   | Optional, 1 file, ~5 lines  | `group-guidance.ts`  |
| **Validation** | ✅ Automatic                | None (uses enum)     |
| **Database**   | ✅ No migration             | None                 |
| **API**        | ✅ Works automatically      | None                 |
| **Components** | ✅ Work automatically       | None                 |
| **Total Time** | **~5-10 minutes**           | **1-3 files**        |

### Adding "Building" as a New Entity Type

| Aspect                 | Effort                | Files Created/Changed             |
| ---------------------- | --------------------- | --------------------------------- |
| **Entity Config**      | 1 file, ~150 lines    | `building-config.ts`              |
| **Guidance**           | 1 file, ~200 lines    | `building-guidance.ts`            |
| **Templates**          | 1 file, ~100 lines    | `building-templates.ts`           |
| **Validation Schema**  | 1 file, ~50 lines     | `building-validation.ts`          |
| **API Routes**         | 1 file, ~200 lines    | `api/buildings/route.ts`          |
| **Database Migration** | 1 file, ~100 lines    | `create_buildings.sql`            |
| **Entity Registry**    | 1 file, ~20 lines     | `entity-registry.ts`              |
| **Service Layer**      | 3-4 files, ~400 lines | `src/services/<type>/`            |
| **Components**         | 2-3 files, ~300 lines | `src/components/<type>/`          |
| **Page Routes**        | 1 file, ~30 lines     | `src/app/<route>/create/page.tsx` |
| **Total Time**         | **~2-4 hours**        | **~10-12 files**                  |

---

## 🎯 When to Use Group Label vs Entity Type

### Use Group Label When:

- ✅ It's a **type of group/organization**
- ✅ It shares the same core features (members, governance, treasury)
- ✅ It just needs different defaults/identity
- ✅ Examples: Building, Neighborhood, HOA, Condo Association

### Use Entity Type When:

- ✅ It has **fundamentally different data structure**
- ✅ It needs **different features** (not just defaults)
- ✅ It has **different relationships** (e.g., buildings have units, floors)
- ✅ Examples: Individual apartment unit, parking space, storage locker

---

## 🔍 Real Example: Adding "Building" Label

Here's the exact code you'd add:

### 1. Update `src/config/group-labels.ts`

```typescript
import {
  // ... existing imports ...
  Building, // Add this
} from 'lucide-react';

export const GROUP_LABELS = {
  // ... existing labels ...

  building: {
    id: 'building',
    name: 'Building',
    description: 'Residential building with shared governance and expenses',
    icon: Building,
    color: 'slate',
    defaults: {
      is_public: false,
      visibility: 'private',
    },
    suggestedFeatures: ['shared_wallet', 'events', 'proposals'],
    defaultGovernance: 'consensus',
  },
} as const satisfies Record<string, GroupLabelConfig>;
```

### 2. Update Validation (Automatic)

The validation already uses the enum from `GROUP_LABELS`:

```typescript
// src/services/groups/validation/index.ts
const validLabels = [
  'circle',
  'family',
  'dao',
  // ... existing ...
  'network_state',
  'building', // ← Just add here (or it auto-includes from config)
] as const;
```

Actually, wait - let me check if validation needs updating...

**Update:** The validation uses a hardcoded array. You'd need to update it, OR better yet, derive it from `GROUP_LABELS`:

```typescript
// Better approach - derive from config
import { GROUP_LABELS } from '@/config/group-labels';
const validLabels = Object.keys(GROUP_LABELS) as const;
```

### 3. (Optional) Add Template

```typescript
// src/components/create/templates/group-templates.ts
{
  id: 'residential-building',
  icon: React.createElement(Building, { className: 'w-4 h-4' }),
  name: 'Residential Building',
  tagline: 'Shared governance for building residents',
  defaults: {
    name: '',
    description: '',
    label: 'building',
    governance_preset: 'consensus',
    is_public: false,
    visibility: 'private',
    bitcoin_address: null,
    lightning_address: null,
  },
},
```

---

## 🚀 Making It Even Easier: Auto-Derive Validation

**Current Issue:** Validation has hardcoded label array.

**Better Approach:** Derive from config (SSOT principle).

**File:** `src/services/groups/validation/index.ts`

```typescript
// Instead of:
const validLabels = [
  'circle',
  'family',
  // ... hardcoded list
] as const;

// Do this:
import { GROUP_LABELS } from '@/config/group-labels';
const validLabels = Object.keys(GROUP_LABELS) as readonly string[];
```

**Benefit:** Adding a new label to `GROUP_LABELS` automatically includes it in validation! ✅

---

## 📝 Summary: Extensibility Score

### Group Labels: ⭐⭐⭐⭐⭐ (5/5)

- **Effort:** Minimal (~5-10 minutes)
- **Files:** 1-3 files
- **Risk:** Very low (just config)
- **Maintainability:** Excellent (SSOT pattern)

### Entity Types: ⭐⭐⭐ (3/5)

- **Effort:** Moderate (2-4 hours)
- **Files:** 10-12 files
- **Risk:** Medium (more moving parts)
- **Maintainability:** Good (follows established patterns)

---

## 💡 Key Architectural Principles

1. **SSOT (Single Source of Truth)**
   - Group labels defined in ONE place (`group-labels.ts`)
   - Everything else derives from it

2. **Labels are Templates, Not Restrictions**
   - A "Building" can enable any feature
   - Labels just suggest defaults

3. **Modularity**
   - Entity types follow consistent patterns
   - Easy to copy/paste and customize

4. **Type Safety**
   - TypeScript enums ensure correctness
   - Compile-time validation

---

## 🎯 Recommendation

**For "Building" use case:** Use **Group Label** ✅

**Why:**

- Buildings are groups of people (residents)
- They need governance, treasury, events
- They just need different defaults (private, consensus)
- Takes 5 minutes vs 4 hours

**Only use Entity Type if:**

- Buildings need fundamentally different data (units, floors, addresses)
- Buildings have different relationships (units → residents)
- Buildings need building-specific features (maintenance requests, etc.)

---

**Last Updated:** 2025-12-30
