# DynamicSidebar Refactor - DRY & Consistent UX

**Created**: 2025-11-24  
**Last Modified**: 2025-12-05  
**Last Modified Summary**: Fixed asset guidance JSX crash and aligned security wrapper context for asset endpoints

## Problem Identified

Initially, I created a **duplicate component** (`FieldGuidanceSidebar`) when we already had `DynamicSidebar` for projects. This violated:

- ❌ DRY principle (Don't Repeat Yourself)
- ❌ Single source of truth
- ❌ Consistent UX (users should see the same familiar interface)

## Solution: Refactor Existing Component

Instead of creating a new component, we **refactored the existing `DynamicSidebar`** to accept content as props.

### What Changed

**2025-12-05**

- Converted `asset-guidance` to use `React.createElement` (no JSX in `.ts` files) to stop Next.js SWC parse errors that blocked `/assets` and `/assets/create`.
- Passed Supabase user context into `withSecurity` for asset-related APIs to return clean 401/429 responses instead of 500s when unauthenticated or rate-limited.

---

1. **Made `DynamicSidebar` generic** - Accepts `guidanceContent` and `defaultContent` as props
2. **Extracted project content** - Moved to `lib/project-guidance.ts`
3. **Profile content** - Already in `lib/profile-guidance.ts`
4. **Wallet content** - Added `lib/wallet-guidance.ts` for wallet flows
5. **Deleted duplicates** - Removed `FieldGuidanceSidebar` and `ProfileGuidanceSidebar`

### Architecture Now

```
DynamicSidebar (single component)
  ├─> Used by projects (with projectGuidanceContent)
  ├─> Used by profiles (with profileGuidanceContent)
  └─> Used by wallets (with walletGuidanceContent)
```

**Same UI/UX, different content** - exactly what we wanted!

## Files Changed

### Modified

- `src/components/create/DynamicSidebar.tsx` - Made generic, accepts content as props
- `src/app/projects/create/page.tsx` - Passes project content to DynamicSidebar
- `src/app/(authenticated)/dashboard/info/page.tsx` - Passes profile content to DynamicSidebar
- `src/components/wizard/ProjectWizard.tsx` - Updated type imports
- `src/lib/profile-guidance.ts` - Updated import to use shared types

### Created

- `src/lib/project-guidance.ts` - Extracted project guidance content

### Deleted

- `src/components/ui/FieldGuidanceSidebar.tsx` - Duplicate, removed
- `src/components/profile/ProfileGuidanceSidebar.tsx` - Duplicate, removed

## Benefits

✅ **DRY** - One component, not two  
✅ **Consistent UX** - Same familiar interface for projects and profiles  
✅ **Maintainable** - Fix bugs once, works everywhere  
✅ **Type-safe** - TypeScript generics ensure type safety  
✅ **No breaking changes** - Projects still work exactly the same

## Code Quality Principles Followed

1. **DRY (Don't Repeat Yourself)** - Single component for both use cases
2. **Separation of Concerns** - UI (component) vs Content (config files)
3. **Single Source of Truth** - One DynamicSidebar component
4. **Consistent UX** - Same interface, different content
5. **No Duplicates** - Removed duplicate components
6. **No Conflicts** - Clean refactor, no breaking changes

## Result

- ✅ Build succeeds
- ✅ No linter errors
- ✅ Same familiar UI/UX for both projects and profiles
- ✅ Less code to maintain
- ✅ Easier to extend in the future

This is the **correct approach** - refactor existing code rather than creating duplicates.
