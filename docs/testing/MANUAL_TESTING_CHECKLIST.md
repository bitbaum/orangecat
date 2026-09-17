# Manual Testing Checklist

**Created:** 2026-01-30  
**Purpose:** Step-by-step manual testing guide for comprehensive app testing  
**Status:** Ready for Use

---

## Prerequisites

1. ✅ Development server is running (`pnpm run dev`)
2. ✅ Server is accessible at `http://localhost:3000`
3. ✅ You are logged in to the application
4. ✅ Database connection is working

---

## Testing Procedure

### Phase 1: Entity List Pages

For each entity type, navigate to its list page and verify:

#### 1. Wallet (`/dashboard/wallets`)

- [ ] Page loads without errors
- [ ] Wallets are displayed (if any exist)
- [ ] "Create" or "Connect" button is present
- [ ] No console errors
- [ ] No 404/500 errors

#### 2. Project (`/dashboard/projects`)

- [ ] Page loads without errors
- [ ] Projects are displayed correctly
- [ ] "Create Project" button works
- [ ] Project cards display all information
- [ ] No console errors

#### 3. Product (`/dashboard/store`)

- [ ] Page loads without errors
- [ ] Products are displayed correctly
- [ ] "Create Product" button works
- [ ] Product cards show price, images, etc.
- [ ] No console errors

#### 4. Service (`/dashboard/services`)

- [ ] Page loads without errors
- [ ] Services are displayed correctly
- [ ] "Create Service" button works
- [ ] Service information is complete
- [ ] No console errors

#### 5. Cause (`/dashboard/causes`)

- [ ] Page loads without errors
- [ ] Causes are displayed correctly
- [ ] "Create Cause" button works
- [ ] Cause information is displayed
- [ ] No console errors

#### 6. AI Assistant (`/dashboard/ai-assistants`)

- [ ] Page loads without errors
- [ ] AI Assistants are displayed
- [ ] "Create AI Assistant" button works
- [ ] Assistant information is shown
- [ ] No console errors

#### 7. Group (`/dashboard/groups`)

- [ ] Page loads without errors
- [ ] Groups are displayed correctly
- [ ] "Create Group" button works
- [ ] Group information is complete
- [ ] No console errors

#### 8. Asset (`/dashboard/assets`)

- [ ] Page loads without errors
- [ ] Assets are displayed correctly
- [ ] "Create Asset" button works
- [ ] Asset details are shown
- [ ] No console errors

#### 9. Loan (`/dashboard/loans`)

- [ ] Page loads without errors
- [ ] Loans are displayed correctly
- [ ] "Create Loan" button works
- [ ] Loan information is complete
- [ ] No console errors

#### 10. Event (`/dashboard/events`)

- [ ] Page loads without errors
- [ ] Events are displayed correctly
- [ ] "Create Event" button works
- [ ] Event details are shown
- [ ] No console errors

---

### Phase 2: Entity Creation

For each entity type, test creation:

#### Test Steps (Repeat for each entity):

1. [ ] Navigate to entity list page
2. [ ] Click "Create" button
3. [ ] Verify create page loads
4. [ ] Fill in required fields
5. [ ] Submit form
6. [ ] Verify entity is created
7. [ ] Verify redirect to correct page
8. [ ] Verify entity appears in list
9. [ ] Test form validation (submit empty form)
10. [ ] Verify error messages display correctly

---

### Phase 3: Entity Editing

For each entity type, test editing:

#### Test Steps (Repeat for each entity):

1. [ ] Navigate to entity detail page
2. [ ] Click "Edit" button (or navigate to edit page)
3. [ ] Verify form pre-populates with existing data
4. [ ] Make changes to fields
5. [ ] Submit form
6. [ ] Verify changes are saved
7. [ ] Verify updated data displays correctly
8. [ ] Test validation on edit

---

### Phase 4: Entity Deletion

For each entity type, test deletion:

#### Test Steps (Repeat for each entity):

1. [ ] Navigate to entity detail page
2. [ ] Click "Delete" button
3. [ ] Confirm deletion (if confirmation dialog appears)
4. [ ] Verify entity is deleted
5. [ ] Verify redirect to list page
6. [ ] Verify entity no longer appears in list

---

### Phase 5: Messaging System

#### Messages Page (`/messages`)

- [ ] Page loads without errors
- [ ] All conversations are displayed
- [ ] Can click on a conversation
- [ ] Messages in conversation are displayed
- [ ] Can send a new message
- [ ] Message appears immediately
- [ ] Can create new conversation
- [ ] Private messages work correctly
- [ ] No console errors
- [ ] Database connection works

---

### Phase 6: Timeline

#### Timeline Page (`/timeline`)

- [ ] Page loads without errors
- [ ] Timeline events are displayed
- [ ] Events are in correct chronological order
- [ ] Can create new timeline event
- [ ] Can edit timeline event
- [ ] Can delete timeline event
- [ ] Changes persist correctly
- [ ] No console errors
- [ ] Database connection works

---

### Phase 7: Error Checking

#### Check for Common Errors:

- [ ] No 404 errors on valid routes
- [ ] No 500 errors during normal operations
- [ ] 404 page displays correctly for invalid routes
- [ ] Error boundaries catch and display errors gracefully
- [ ] Database connection errors are handled
- [ ] Network errors are handled
- [ ] Console has no errors (check browser DevTools)

---

### Phase 8: Engineering Principles Compliance

#### DRY (Don't Repeat Yourself)

- [ ] Entity pages use shared components (check code)
- [ ] API routes use generic handlers
- [ ] No duplicate code patterns

#### SSOT (Single Source of Truth)

- [ ] Entity registry is used (`src/config/entity-registry.ts`)
- [ ] No hardcoded entity names
- [ ] Routes come from registry

#### Separation of Concerns

- [ ] API routes are thin
- [ ] Components don't contain business logic
- [ ] Domain services handle business logic

#### Type Safety

- [ ] Forms validate input
- [ ] API endpoints validate requests
- [ ] No TypeScript errors

---

## Issues Log

Document any issues found:

### Critical Issues (Blocks functionality)

- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Medium Issues (Affects UX but workaround exists)

- [ ] Issue 1: Description
- [ ] Issue 2: Description

### Minor Issues (Cosmetic or edge cases)

- [ ] Issue 1: Description
- [ ] Issue 2: Description

---

## Test Results Summary

**Date:** ******\_\_\_******  
**Tester:** ******\_\_\_******  
**Environment:** Development / Production

**Overall Status:** ⬜ Pass ⬜ Fail ⬜ Partial

**Entities Tested:** **_ / 10  
**Features Tested:** ⬜ Messaging ⬜ Timeline  
**Issues Found:** _** Critical, **_ Medium, _** Minor

---

_Last Updated: 2026-01-30_
