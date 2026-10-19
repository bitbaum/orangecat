# Profile Info Workflow Testing Guide

**Created**: 2025-11-24  
**Purpose**: Step-by-step testing guide for the new "My Info" view/edit workflow

## 🎯 Testing Objectives

1. Verify "My Info" shows **view mode** (read-only display)
2. Verify "Edit Profile" button navigates to edit mode
3. Verify edit mode has guidance sidebar (same as projects)
4. Verify wallets are NOT in profile editor (separate page)
5. Verify navigation flows work correctly

---

## 📋 Test Scenarios

### Test 1: Access "My Info" from Sidebar

**Steps:**

1. Sign in to the application
2. Click "My Info" in the dashboard sidebar
3. **Expected Result:**
   - URL should be: `/dashboard/info`
   - Page title: "My Info"
   - Should show **read-only** profile information
   - Should display:
     - Profile Overview (bio, stats, contact info)
     - Detailed Info (username, name, email, location, website, social links, etc.)
   - Should have prominent "Edit Profile" button in header
   - Should have "Quick Actions" section at bottom
   - **Should NOT show edit forms or input fields**

**Screenshot locations to check:**

- Header with "My Info" title and "Edit Profile" button
- Profile Overview section
- Profile Information section (all read-only)
- Quick Actions card

---

### Test 2: Navigate to Edit Mode from View

**Steps:**

1. From `/dashboard/info` (view mode)
2. Click the "Edit Profile" button in the header
3. **Expected Result:**
   - URL should change to: `/dashboard/info/edit`
   - Page title: "Edit Profile"
   - Should show **edit form** with all profile fields
   - Should have **guidance sidebar** on the right (desktop)
   - Should show profile completion percentage
   - Should have "Back to View" button
   - Should have Save/Cancel buttons

**What to verify in edit mode:**

- ✅ Guidance sidebar appears (same style as project editing)
- ✅ Profile completion progress bar visible
- ✅ All form fields are editable
- ✅ Social links editor is present
- ✅ Contact email and phone fields present
- ✅ **NO wallet editing** (only link to wallets page)
- ✅ Mobile guidance button appears when focusing fields

---

### Test 3: Edit Profile from Dropdown Menu

**Steps:**

1. Click user avatar/profile icon in top right
2. Click "Edit Profile" from dropdown menu
3. **Expected Result:**
   - Should navigate directly to `/dashboard/info/edit`
   - Should show edit mode (same as Test 2)
   - Should NOT go to public profile view

---

### Test 4: Save Changes and Return to View

**Steps:**

1. From `/dashboard/info/edit`
2. Make some changes (e.g., update bio, add social link)
3. Click "Save" button
4. **Expected Result:**
   - Should show success toast notification
   - Should automatically redirect to `/dashboard/info` (view mode)
   - Changes should be visible in view mode
   - Profile should be updated

---

### Test 5: Cancel Editing

**Steps:**

1. From `/dashboard/info/edit`
2. Make some changes
3. Click "Cancel" or "Back to View" button
4. **Expected Result:**
   - Should navigate back to `/dashboard/info` (view mode)
   - Changes should NOT be saved
   - Original values should still be displayed

---

### Test 6: Verify Wallets Separation

**Steps:**

1. Navigate to `/dashboard/info/edit`
2. Scroll through the form
3. **Expected Result:**
   - Should see social links section
   - Should see contact information section
   - Should see helpful text: "💡 Want to add wallets? Manage them in My Wallets"
   - Should have link to `/dashboard/wallets`
   - **Should NOT see wallet address fields in profile editor**
   - **Should NOT see wallet management UI in profile editor**

---

### Test 7: Guidance Sidebar Functionality

**Steps:**

1. Navigate to `/dashboard/info/edit`
2. Click/focus on different form fields
3. **Expected Result:**
   - Guidance sidebar should update based on focused field
   - Should show relevant tips and best practices
   - Should match the same UX as project editing guidance
   - On mobile, should show floating help button when field is focused
   - Clicking help button should open guidance modal

**Fields to test:**

- Username field
- Bio field
- Social links section
- Contact email field
- Location field

---

### Test 8: Quick Actions from View Mode

**Steps:**

1. Navigate to `/dashboard/info`
2. Scroll to "Quick Actions" section
3. **Expected Result:**
   - Should see "Edit Profile" button → goes to `/dashboard/info/edit`
   - Should see "View Public Profile" button → goes to `/profiles/{username}`
   - Should see "Manage Wallets" button → goes to `/dashboard/wallets`
   - All buttons should work correctly

---

## 🔍 Visual Verification Checklist

### View Mode (`/dashboard/info`)

- [ ] Clean, reader-friendly layout
- [ ] All information displayed clearly
- [ ] No edit forms visible
- [ ] "Edit Profile" button prominent
- [ ] Quick Actions section visible
- [ ] Social links display correctly (if any)
- [ ] Contact email and phone display correctly (if set)

### Edit Mode (`/dashboard/info/edit`)

- [ ] Form fields are editable
- [ ] Guidance sidebar visible (desktop)
- [ ] Profile completion percentage shown
- [ ] "Back to View" button present
- [ ] Save/Cancel buttons present
- [ ] No wallet editing fields
- [ ] Link to wallets page present
- [ ] Mobile guidance button appears when needed

---

## 🐛 Common Issues to Watch For

1. **View mode showing edit forms**
   - Check that `onSave` prop is NOT passed to `ProfileInfoTab`
   - Verify URL is `/dashboard/info` not `/dashboard/info/edit`

2. **Edit mode missing guidance sidebar**
   - Check that `DynamicSidebar` is included in edit page
   - Verify `onFieldFocus` prop is passed to `ModernProfileEditor`

3. **Wallets appearing in profile editor**
   - Verify `ModernProfileEditor` doesn't include wallet fields
   - Should only show link to wallets page

4. **Navigation not working**
   - Check sidebar link points to `/dashboard/info`
   - Check dropdown "Edit Profile" points to `/dashboard/info/edit`
   - Verify all Link components have correct hrefs

---

## 📝 Notes

- The view mode is intentionally read-only to reduce cognitive load
- Edit mode uses the same guidance system as project editing for consistency
- Wallets are intentionally separated for better organization
- All navigation should be clear and intuitive

---

## ✅ Success Criteria

All tests pass when:

1. ✅ "My Info" shows clean view mode by default
2. ✅ Edit mode accessible via clear button/link
3. ✅ Guidance sidebar works in edit mode
4. ✅ Wallets are separate (not in profile editor)
5. ✅ Navigation flows are logical and consistent
6. ✅ Save/Cancel work correctly
7. ✅ Mobile experience is good



