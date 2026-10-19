# Touch Target Audit - PostComposerMobile

**Date:** 2025-11-16
**File:** `src/components/timeline/PostComposerMobile.tsx`
**Standard:** Apple/Google recommend 44px minimum for touch targets

---

## Audit Results

### ✅ PASSING Touch Targets (≥44px)

1. **Post Button (Line 308-331)**
   ```tsx
   min-h-[44px] min-w-[80px]
   ```

   - ✅ Height: 44px minimum
   - ✅ Width: 80px minimum
   - Status: **COMPLIANT**

### ❌ FAILING Touch Targets (<44px)

2. **Avatar Chevron Button (Line 105-115)**

   ```tsx
   <button onClick={() => setShowOptions(!showOptions)}>
     <Globe className="w-3 h-3" />
     {composer.visibility === 'public' ? 'Public' : 'Private'}
     <ChevronDown className="w-3 h-3" />
   </button>
   ```

   - ❌ No explicit height/width
   - ❌ Icons only 3x3 (12px)
   - **Current:** ~20-24px
   - **Required:** 44px minimum
   - **Fix Needed:** Add `min-h-[44px] p-2`

3. **Options Toggle Button (Line 276-283)**

   ```tsx
   <button onClick={() => setShowOptions(true)} className="text-gray-500 hover:text-gray-700 p-2">
     <ChevronDown className="w-5 h-5" />
   </button>
   ```

   - ❌ Icon: 5x5 (20px)
   - ❌ Padding: 8px (p-2)
   - **Current:** ~36px
   - **Required:** 44px minimum
   - **Fix Needed:** Change to `p-3` or `min-h-[44px] min-w-[44px]`

4. **Visibility Buttons (Public/Private) (Line 160-184)**

   ```tsx
   <button className="flex items-center gap-2 px-3 py-2 rounded-md">
     <Globe className="w-4 h-4" />
     Public
   </button>
   ```

   - ❌ Padding: `py-2` = 8px top + 8px bottom = 16px
   - ❌ Icon: 4x4 (16px)
   - **Current:** ~32px height
   - **Required:** 44px minimum
   - **Fix Needed:** Change to `py-3` (12px) = 40px or `min-h-[44px]`

5. **Project Selection Buttons (Line 203-232)**

   ```tsx
   <button className="flex items-center gap-3 w-full p-3 rounded-lg">
     <div className="w-5 h-5 rounded border-2">...</div>
     <div className="text-sm">{project.title}</div>
   </button>
   ```

   - ✅ Padding: `p-3` = 12px all sides
   - ✅ **Estimated:** ~40-44px (depends on text)
   - **Status:** Likely compliant but should verify

6. **Cancel Button (Line 295-305)**

   ```tsx
   <Button variant="outline" size="sm" onClick={onCancel}>
     Cancel
   </Button>
   ```

   - ⚠️ Size: "sm" - Unknown exact size
   - **Need to check:** `Button` component definition
   - **Status:** NEEDS VERIFICATION

7. **Close Error Button (Line 246-252)**

   ```tsx
   <button onClick={composer.clearError} className="text-red-400">
     <X className="w-4 h-4" />
   </button>
   ```

   - ❌ Icon only: 4x4 (16px)
   - ❌ No padding specified
   - **Current:** ~16-20px
   - **Required:** 44px minimum
   - **Fix Needed:** Add `min-h-[44px] min-w-[44px] p-3`

8. **Project Selector Toggle (Line 191-198)**

   ```tsx
   <button onClick={() => setShowProjectSelector(!showProjectSelector)}>
     Also post to projects...
     <ChevronDown className="w-4 h-4" />
   </button>
   ```

   - ❌ No explicit height
   - **Current:** ~28-32px (text only)
   - **Required:** 44px minimum
   - **Fix Needed:** Add `min-h-[44px] py-3`

9. **Individual Project Checkboxes (Line 215-225)**
   ```tsx
   <div className="w-5 h-5 rounded border-2">{selected && <Check className="w-3 h-3" />}</div>
   ```

   - ❌ Checkbox: 5x5 (20px)
   - **Current:** 20px
   - **Required:** 44px minimum
   - **Note:** Checkbox is inside button (line 203), so overall button should be 44px

### ⚠️ NEEDS VERIFICATION

10. **Textarea (Line 122-137)**
    - Not a traditional touch target
    - Large surface area (full width)
    - **Status:** OK (not a button)

11. **Compact Mode Post Button (Line 318)**
    ```tsx
    ${compact ? 'px-4 py-1.5 text-sm min-h-[36px]' : ''}
    ```

    - ❌ Compact mode: `min-h-[36px]`
    - **Current:** 36px
    - **Required:** 44px minimum
    - **Fix Needed:** Remove compact mode height override OR use 44px

---

## Summary

### Touch Target Compliance

| Element                 | Current Size | Required | Status    |
| ----------------------- | ------------ | -------- | --------- |
| Post button (normal)    | 44px+        | 44px     | ✅ PASS   |
| Post button (compact)   | 36px         | 44px     | ❌ FAIL   |
| Avatar chevron          | ~24px        | 44px     | ❌ FAIL   |
| Options toggle          | ~36px        | 44px     | ❌ FAIL   |
| Visibility buttons      | ~32px        | 44px     | ❌ FAIL   |
| Project buttons         | ~40px        | 44px     | ⚠️ VERIFY |
| Cancel button           | Unknown      | 44px     | ⚠️ VERIFY |
| Close error             | ~20px        | 44px     | ❌ FAIL   |
| Project selector toggle | ~32px        | 44px     | ❌ FAIL   |

**Results:**

- ✅ Passing: 1/9 (11%)
- ❌ Failing: 6/9 (67%)
- ⚠️ Needs verification: 2/9 (22%)

---

## Required Fixes

### Priority 1: Critical Failures (<30px)

1. **Close Error Button (16-20px)**

   ```tsx
   // Before
   <button onClick={composer.clearError} className="text-red-400">
     <X className="w-4 h-4" />
   </button>

   // After
   <button
     onClick={composer.clearError}
     className="text-red-400 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
     aria-label="Dismiss error"
   >
     <X className="w-4 h-4" />
   </button>
   ```

2. **Avatar Chevron Button (~24px)**

   ```tsx
   // Before
   <button onClick={() => setShowOptions(!showOptions)} className="flex items-center gap-1 text-xs">

   // After
   <button
     onClick={() => setShowOptions(!showOptions)}
     className="flex items-center gap-1 text-xs min-h-[44px] px-2"
   >
   ```

### Priority 2: Close Failures (30-40px)

3. **Visibility Toggle Buttons (~32px)**

   ```tsx
   // Before
   className = 'flex items-center gap-2 px-3 py-2 rounded-md';

   // After
   className = 'flex items-center gap-2 px-3 py-3 rounded-md min-h-[44px]';
   ```

4. **Project Selector Toggle (~32px)**

   ```tsx
   // Before
   <button onClick={() => setShowProjectSelector(!showProjectSelector)} className="flex items-center justify-between w-full">

   // After
   <button
     onClick={() => setShowProjectSelector(!showProjectSelector)}
     className="flex items-center justify-between w-full min-h-[44px] py-3"
   >
   ```

5. **Options Toggle Button (~36px)**

   ```tsx
   // Before
   className = 'text-gray-500 hover:text-gray-700 p-2';

   // After
   className = 'text-gray-500 hover:text-gray-700 p-3 min-h-[44px] min-w-[44px]';
   ```

6. **Compact Mode Post Button (36px)**

   ```tsx
   // Before
   ${compact ? 'px-4 py-1.5 text-sm min-h-[36px]' : ''}

   // After
   ${compact ? 'px-4 py-2 text-sm min-h-[44px]' : ''}
   ```

### Priority 3: Verification Needed

7. **Check Button component `size="sm"` definition**
   - Location: `src/components/ui/Button.tsx`
   - Ensure `sm` size is ≥44px for touch targets

8. **Verify Project Selection buttons with real content**
   - Test with various project title lengths
   - Ensure minimum 44px height maintained

---

## Implementation Plan

### Step 1: Fix Critical Failures (5 minutes)

- Close error button
- Avatar chevron button

### Step 2: Fix Close Failures (10 minutes)

- Visibility toggle buttons
- Project selector toggle
- Options toggle button
- Compact mode post button

### Step 3: Verify Button Component (5 minutes)

- Read `Button.tsx`
- Check `size="sm"` definition
- Update if needed

### Step 4: Test on Device (15 minutes)

- Test all interactions on mobile
- Verify 44px minimum with browser dev tools
- Check with physical device

---

## Testing Checklist

### Desktop Testing (Chrome DevTools)

- [ ] Enable device toolbar (Ctrl+Shift+M)
- [ ] Select iPhone 14 Pro (393x852)
- [ ] Inspect each button element
- [ ] Verify computed height ≥44px
- [ ] Verify computed width ≥44px for icon-only buttons

### Mobile Testing (Physical Device)

- [ ] Test on iPhone (iOS)
- [ ] Test on Android device
- [ ] Verify easy tap without precision
- [ ] Check for accidental taps on adjacent buttons
- [ ] Test with one-handed use (thumb reach)

---

## References

- **Apple Human Interface Guidelines:** 44pt minimum touch target
- **Google Material Design:** 48dp minimum (≈44-48px)
- **WCAG 2.1 Success Criterion 2.5.5:** Target Size (Level AAA) - 44×44 CSS pixels

---

**Next Steps:**

1. Create fixes branch
2. Apply all Priority 1 & 2 fixes
3. Verify Button component
4. Test on mobile devices
5. Submit PR with screenshots

**Estimated Time:** ~45 minutes total
