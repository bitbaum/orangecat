# Entity Pages DRY Review

**Created:** 2025-01-30  
**Purpose:** Review all entity pages for DRY violations and unnecessary custom layouts

---

## 📋 Current State Analysis

### ✅ Using EntityListShell (DRY, Consistent)
- `/dashboard/store` (Products) - Uses `EntityListShell` + `EntityList`
- `/dashboard/services` - Uses `EntityListShell` + `EntityList`
- `/dashboard/causes` - Uses `EntityListShell` + `EntityList`
- `/dashboard/assets` - Uses `EntityListShell` + `EntityList`
- `/dashboard/ai-assistants` - Uses `EntityListShell` + `EntityList`
- `/dashboard/groups` - Uses `EntityListShell` (just refactored)

### ❌ Custom Layouts (Need Refactoring)
- `/dashboard/projects` - Uses `EntityListPage` (different component, custom layout)
- `/dashboard/loans` - Uses completely custom layout (container, custom header, stats cards)

### 🔍 Issues Found

1. **Projects Page:**
   - Uses `EntityListPage` instead of `EntityListShell`
   - Has custom tabs, search, filters
   - Could potentially use `EntityListShell` with custom content inside

2. **Loans Page:**
   - Completely custom layout
   - Custom header with icon
   - Custom stats cards
   - Uses `LoanDashboard` component
   - Should use `EntityListShell` for consistency

---

## 🎯 Standardization Plan

### Pattern to Follow
All entity list pages should use:
```tsx
<EntityListShell
  title="My {Entity}"
  description="..."
  headerActions={<Button>Create {Entity}</Button>}
>
  <EntityList
    items={items}
    makeHref={...}
    makeCardProps={...}
    emptyState={...}
  />
</EntityListShell>
```

### Special Cases
- **Projects:** Has tabs (My Projects / Favorites) - can keep tabs inside EntityListShell
- **Loans:** Has stats cards - can add stats section inside EntityListShell

---

## 🔧 Implementation

### 1. Remove BitBaum from Logo
- Remove "A BitBaum Company" text from Logo component

### 2. Remove Experimental Banner
- Remove ExperimentalBanner from HomePublicClient
- Keep component file (might be used elsewhere)

### 3. Refactor Loans Page
- Use EntityListShell for header
- Move stats cards inside EntityListShell
- Keep LoanDashboard component but wrap in EntityListShell

### 4. Review Projects Page
- Consider if EntityListPage is necessary or can use EntityListShell
- Projects has complex features (tabs, search, filters) - may need custom approach

---

**Last Modified:** 2025-01-30  
**Last Modified Summary:** Initial review of entity pages for DRY violations
