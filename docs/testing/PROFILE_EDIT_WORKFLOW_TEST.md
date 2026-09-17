# Profile Editing Workflow - Manual Test Guide

**Created:** 2025-11-24  
**Last Modified:** 2025-11-24  
**Last Modified Summary:** Comprehensive manual test guide for profile editing workflow

---

## 🎯 Test Objective

Verify that users can successfully:

1. Enter location information (using Nominatim)
2. Add phone number
3. Fill out all profile fields
4. Save everything correctly
5. See saved data on profile page

---

## 📋 Pre-Test Checklist

- [ ] Dev server is running (`pnpm run dev`)
- [ ] You have a test account or can create one
- [ ] Browser console is open (F12) to check for errors

---

## 🧪 Test Steps

### Step 1: Navigate to Profile Edit Page

1. **Login** to your account
2. Navigate to: `http://localhost:3000/dashboard/info/edit`
3. ✅ **Verify:** Profile edit form loads without errors

---

### Step 2: Test Location Entry

**Test Case 2.1: City Name Entry**

1. Find the **Location** field (has a map pin icon)
2. Click in the input field
3. Type: `Zurich`
4. ✅ **Expected:** Suggestions appear after 1-2 seconds (Nominatim API)
5. Click on a suggestion (e.g., "Zurich, Switzerland")
6. ✅ **Expected:** Field fills with full address

**Test Case 2.2: Zip Code Entry (Swiss)**

1. Clear the location field
2. Type: `8053`
3. ✅ **Expected:**
   - Suggestions appear OR
   - Auto-fills with "Zurich, Zurich, Switzerland" (if zip lookup works)

**Test Case 2.3: International Location**

1. Clear the location field
2. Type: `New York`
3. ✅ **Expected:** Suggestions appear with "New York, NY, USA" options
4. Select one
5. ✅ **Expected:** Field fills correctly

**Verify in Console:**

- Open browser console (F12)
- Check for any errors related to Nominatim API
- ✅ **Expected:** No errors, API calls succeed

---

### Step 3: Test Phone Number Entry

**Test Case 3.1: Swiss Format**

1. Find the **Phone** field
2. Enter: `0783226939`
3. ✅ **Expected:** No validation error
4. Tab out of field
5. ✅ **Expected:** Field accepts the value

**Test Case 3.2: International Format**

1. Clear phone field
2. Enter: `+41-78-322693`
3. ✅ **Expected:** No validation error
4. Tab out of field
5. ✅ **Expected:** Field accepts the value

**Test Case 3.3: Invalid Format (Optional)**

1. Clear phone field
2. Enter: `123` (too short)
3. Tab out of field
4. ✅ **Expected:** May show validation error (depends on validation rules)

---

### Step 4: Test Other Profile Fields

**Test Case 4.1: Bio**

1. Find the **Bio** textarea
2. Enter: `This is a test bio to verify the profile editing workflow works correctly.`
3. ✅ **Expected:** Text is accepted

**Test Case 4.2: Website**

1. Find the **Website** field
2. Enter: `orangecat.ch` (without https://)
3. ✅ **Expected:** No validation error (should accept domain without protocol)
4. Tab out of field
5. ✅ **Expected:** Field accepts the value

**Test Case 4.3: Name**

1. Find the **Name** field
2. Enter: `Test User`
3. ✅ **Expected:** Text is accepted

**Test Case 4.4: Username**

1. Find the **Username** field
2. Verify it's filled (should be auto-filled from email)
3. ✅ **Expected:** Username is valid (3-30 chars, alphanumeric)

---

### Step 5: Save the Form

1. Scroll to the bottom of the form
2. Find the **Save** button
3. ✅ **Verify:** Save button is visible and enabled
4. Click **Save**
5. ✅ **Expected:**
   - Button shows loading state
   - Success message appears (toast notification)
   - Page redirects to `/dashboard/info` (view mode)
   - OR stays on edit page with success message

**Verify in Console:**

- Check for any errors during save
- ✅ **Expected:** No errors, save request succeeds

---

### Step 6: Verify Saved Data

1. Navigate to: `http://localhost:3000/dashboard/info`
2. ✅ **Verify Location:**
   - Location is displayed
   - Shows city and country (e.g., "Zurich, Switzerland")
   - OR shows formatted address

3. ✅ **Verify Phone:**
   - Phone number is displayed
   - Format is correct (may be normalized)

4. ✅ **Verify Bio:**
   - Bio text is displayed
   - Matches what you entered

5. ✅ **Verify Website:**
   - Website is displayed
   - Link is clickable (if applicable)

6. ✅ **Verify Name:**
   - Name is displayed
   - Matches what you entered

---

### Step 7: Test Edit Again

1. Click **Edit** button (if available) or navigate to `/dashboard/info/edit`
2. ✅ **Verify:** All previously entered data is pre-filled
3. Make a small change (e.g., update bio)
4. Save again
5. ✅ **Verify:** Changes are saved correctly

---

### Step 8: Test Form Validation

**Test Case 8.1: Invalid Website**

1. Go to edit page
2. Enter invalid website: `not-a-valid-website`
3. Tab out of field
4. ✅ **Expected:** Validation error message appears

**Test Case 8.2: Invalid Username**

1. Enter username: `ab` (too short)
2. Tab out of field
3. ✅ **Expected:** Validation error: "Username must be at least 3 characters"

**Test Case 8.3: Invalid Email (if contact_email field exists)**

1. Enter: `not-an-email`
2. Tab out of field
3. ✅ **Expected:** Validation error: "Please enter a valid email address"

---

## ✅ Success Criteria

All of the following must pass:

- [x] Location entry works with Nominatim (city names)
- [x] Location entry works with zip codes (Swiss)
- [x] Phone number accepts Swiss format
- [x] Phone number accepts international format
- [x] Bio field saves correctly
- [x] Website field accepts domain without https://
- [x] Name field saves correctly
- [x] Form saves without errors
- [x] Saved data appears on profile view page
- [x] Form validation works for invalid inputs
- [x] Data persists after page refresh

---

## 🐛 Common Issues & Solutions

### Issue: Location suggestions don't appear

**Solution:**

- Check browser console for Nominatim API errors
- Verify internet connection
- Try typing a well-known city name
- Wait 2-3 seconds for API response

### Issue: Save button doesn't work

**Solution:**

- Check browser console for errors
- Verify all required fields are filled
- Check form validation errors
- Try refreshing the page

### Issue: Data doesn't appear after save

**Solution:**

- Check browser console for save errors
- Verify database connection
- Check if redirect happened correctly
- Refresh the profile view page

### Issue: Validation errors don't appear

**Solution:**

- Check if form validation is enabled
- Try tabbing out of fields
- Check browser console for validation errors

---

## 📊 Test Results Template

```
Date: ___________
Tester: ___________

Location Entry:
  [ ] City name works
  [ ] Zip code works
  [ ] International locations work
  [ ] Suggestions appear correctly

Phone Entry:
  [ ] Swiss format accepted
  [ ] International format accepted
  [ ] Validation works

Other Fields:
  [ ] Bio saves correctly
  [ ] Website saves correctly
  [ ] Name saves correctly

Save Functionality:
  [ ] Save button works
  [ ] Success message appears
  [ ] Redirect works correctly

Data Verification:
  [ ] Location appears on profile
  [ ] Phone appears on profile
  [ ] Bio appears on profile
  [ ] Website appears on profile

Form Validation:
  [ ] Invalid website shows error
  [ ] Invalid username shows error
  [ ] Invalid email shows error

Overall Status: [ ] PASS [ ] FAIL
Notes: ________________________________
```

---

## 🔗 Related Documentation

- [Location Setup Guide](../development/guides/LOCATION_SETUP.md)
- [Location System Analysis](../architecture/LOCATION_SYSTEM_ANALYSIS.md)
- [Profile Validation](../architecture/validation.md)
