# Active Refactoring Tasks

**Created:** 2025-01-30  
**Last Modified:** 2025-01-30  
**Last Modified Summary:** Groups unification complete - Phase 6 cleanup finished, all circles code removed  
**Purpose:** Track all active refactoring work to avoid forgetting tasks

---

## 🎯 Current Active Work

### 1. Groups Unification (Circles + Organizations) ✅ COMPLETE

**Status:** ✅ **COMPLETE** - All phases finished, migrations applied, database working

**Details:** See `GROUPS_UNIFICATION_PLAN.md` and `MIGRATION_COMPLETE.md`

**Progress:**
- ✅ Phase 1: Database migration complete (organizations → groups)
- ✅ Phase 2: Service unification (100% - all modules created)
- ✅ Phase 3: Component unification (100% - all components created)
- ✅ Phase 4: Route & API unification (100% - all routes updated)
- ✅ Phase 5: Data migration applied (organizations migrated to groups)
- ✅ Phase 6: Cleanup complete (all dual-table code removed)
- ✅ Actor Table: Created and populated (17 actors: users + groups)
- ✅ Entity Cards: Unified (ProjectCard variant created, duplicates replaced)

**Database Status:**
- Groups: 3
- Actors: 17 (users + groups)
- Group Members: 3

**Status:** ✅ **PRODUCTION READY** - All migrations applied, database working, code updated

---

## 📋 Other Planned Refactorings

### High Priority (>800 lines)

1. **`src/components/loans/CreateLoanDialog.tsx`** (841 → 260 lines, 69% reduction) ✅
   - **Status:** ✅ Complete
   - **Pattern:** Extracted types, validation, constants, hooks, and 5 form sections
   - **Modules Created:** `types.ts`, `validation.ts`, `constants.ts`, `hooks/useLoanCategories.ts`, `hooks/useAssets.ts`, `sections/BasicInfoSection.tsx`, `sections/FinancialDetailsSection.tsx`, `sections/LenderInfoSection.tsx`, `sections/PreferencesSection.tsx`, `sections/CollateralSection.tsx`

2. **`src/components/profile/ModernProfileEditor.tsx`** (857 → 206 lines, 76% reduction) ✅
   - **Status:** ✅ Complete
   - **Pattern:** Extracted types, constants, and 4 form sections (ProfileBasicSection, ProfileLocationSection, OnlinePresenceSection, ContactSection), plus FormErrorDisplay and ProfileFormActions components
   - **Modules Created:** `types.ts`, `constants.ts`, `sections/ProfileBasicSection.tsx`, `sections/ProfileLocationSection.tsx`, `sections/OnlinePresenceSection.tsx`, `sections/ContactSection.tsx`, `components/FormErrorDisplay.tsx`, `components/ProfileFormActions.tsx`

3. **`src/components/create/templates/templates-data.ts`** (916 → 25 lines, 97% reduction) ✅
   - **Status:** ✅ Complete
   - **Pattern:** Split by template category into 8 modular files (product, service, cause, loan, ai-assistant, project, asset, event)
   - **Modules Created:** `product-templates.ts`, `service-templates.ts`, `cause-templates.ts`, `loan-templates.ts`, `ai-assistant-templates.ts`, `project-templates.ts`, `asset-templates.ts`, `event-templates.ts`, `index.ts`

### Medium Priority (600-900 lines)

4. **`src/app/(authenticated)/dashboard/wallets/page.tsx`** (900 → 143 lines, 84% reduction) ✅
   - **Status:** ✅ Complete
   - **Pattern:** Extracted 3 custom hooks (useWallets, useWalletOperations, useResponsiveLayout) and 5 components (WalletsPageHeader, WalletsHelpSection, WalletsErrorState, WalletsGuidanceSidebar, WalletsMobileGuidance)
   - **Modules Created:** `hooks/useWallets.ts`, `hooks/useWalletOperations.ts`, `hooks/useResponsiveLayout.ts`, `components/WalletsPageHeader.tsx`, `components/WalletsHelpSection.tsx`, `components/WalletsErrorState.tsx`, `components/WalletsGuidanceSidebar.tsx`, `components/WalletsMobileGuidance.tsx`

5. **`src/services/loans/index.ts`** (807 lines)
   - **Status:** ⏳ Pending
   - **Pattern:** Extract queries, mutations, types, constants
   - **Effort:** 2-3 hours
   - **Reference:** Similar to timeline/search refactoring

6. **`src/app/organizations/page.tsx`** (761 lines)
   - **Status:** ⏳ Pending (may be affected by groups unification)
   - **Pattern:** Extract components, hooks
   - **Effort:** 2-3 hours

---

## ✅ Completed Refactorings

1. ✅ Search Service (919 → 204 lines + 4 modules)
2. ✅ Discover Page (826 → 473 lines + 3 components)
3. ✅ Security Service (828 → 34 lines + 8 modules)
4. ✅ ProjectWizard (829 → 591 lines + 4 modules)
5. ✅ Timeline Feeds (878 → modular structure)
6. ✅ AI Guides Organization
7. ✅ CreateLoanDialog (841 → 260 lines + 9 modules, 69% reduction)
8. ✅ ModernProfileEditor (857 → 206 lines + 8 modules, 76% reduction)
9. ✅ templates-data.ts (916 → 25 lines + 8 modules, 97% reduction)
10. ✅ wallets/page.tsx (900 → 143 lines + 8 modules, 84% reduction)

---

## 📊 Priority Order

**Current Focus:**
1. ✅ Groups Unification Phase 4 (COMPLETE - all routes and API endpoints unified)
2. ✅ Project Support System (COMPLETE - all phases done)
   - ✅ Database schema designed
   - ✅ Migration file created (`20250130000003_add_project_support.sql`)
   - ✅ Service layer (types, validation, queries, mutations)
   - ✅ API endpoints (`/api/projects/[id]/support`)
   - ✅ Components (SupportButton, SupportModal, ReactionPicker, SupportStats, WallOfSupport)
   - ✅ Integrated into project pages
5. ✅ Entity Cards DRY Unification (COMPLETE)
   - See `ENTITY_CARDS_UNIFICATION_PLAN.md`
   - Products/Services: ✅ Using EntityCard
   - Projects: ✅ Using ProjectCard variant (extends EntityCard)
   - Groups: ✅ Using GroupCard (extends EntityCard)
   - Commerce: ✅ Using EntityCard
   - Status: ✅ All cards unified, duplicates replaced
4. ✅ CreateLoanDialog (COMPLETE)
5. Then: ModernProfileEditor (2-3 hours)
6. Then: templates-data.ts (1-2 hours)

**After that:**
7. wallets/page.tsx (2-3 hours)
8. loans/index.ts (2-3 hours)
9. organizations/page.tsx (2-3 hours, may be affected by unification)

---

## 🚨 Critical: Entity Cards DRY Violation

**Problem:** Multiple card components (EntityCard, CommerceCard, ModernProjectCard, DashboardProjectCard) violate DRY principle.

**Impact:** Inconsistent UI, duplicate code, maintenance burden.

**Plan:** See `ENTITY_CARDS_DRY_AUDIT_2025-01-30.md`

**Priority:** HIGH - Should be done after Groups Phase 3 (so groups use unified cards)

---

**Note:** This document is updated as work progresses. Check REFACTORING_SUMMARY_2025-01-30.md for detailed progress.

