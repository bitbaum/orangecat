# Project Create Form Architecture

## Overview

The refactored project creation form is a conversion-optimized, demo-first experience designed to minimize friction and maximize user success. It features contextual guidance, real-time feedback, and smart defaults tailored for Bitcoin-savvy users.

## Philosophy

1. **Demo-First**: Users can create and publish projects without blockers (e.g., Bitcoin address optional)
2. **Contextual Guidance**: Just-in-time help appears based on the field being edited
3. **Progressive Disclosure**: Advanced features hidden until needed
4. **Conversion-Focused**: Every element serves to reduce drop-off and increase completion

## File Structure

```
src/
├── components/
│   ├── create/
│   │   ├── guidance/
│   │   │   ├── FieldGuidance.tsx       # Contextual help sidebar
│   │   │   ├── StickyProgress.tsx      # Sticky progress indicator
│   │   │   ├── CurrencyConverter.tsx   # BTC/SATS/Fiat converter
│   │   │   └── index.ts                # Module exports
│   │   └── templates/
│   │       └── ProjectTemplates.tsx    # Pre-filled examples
│   ├── wizard/
│   │   ├── ProjectWizard.tsx           # Main form component (refactored)
│   │   └── ProjectWizard.tsx.backup    # Original (backup)
│   └── project/
│       └── MissingWalletBanner.tsx     # Post-creation wallet prompt
├── app/
│   ├── projects/create/page.tsx        # Create page route
│   └── (authenticated)/project/[id]/
│       └── page.tsx                    # Project detail page
└── app/wallets/page.tsx                # Wallet education page
```

## Component Architecture

### 1. ProjectWizard (Main Form)

**Path**: `src/components/wizard/ProjectWizard.tsx`

**Purpose**: Main project creation form with integrated guidance system

**Key Features**:

- Single-page form (no wizard steps)
- Real-time validation with inline error messages
- Autosave to localStorage every 10 seconds
- Smart field focus detection for contextual help
- Template loading from URL params or user selection

**State Management**:

```typescript
interface ProjectFormData {
  title: string; // Required
  description: string; // Required
  goalAmount: string; // Optional
  goalCurrency: 'CHF' | 'USD' | 'EUR' | 'BTC' | 'SATS';
  fundingPurpose: string; // Optional
  bitcoinAddress: string; // Optional (can add later)
  selectedCategories: string[]; // Optional
}
```

**Validation Rules**:

- Title: 3-100 characters, required
- Description: No minimum, 2000 max, required
- Goal Amount: Positive number, optional
- Bitcoin Address: Valid format (bc1..., 1..., 3...), optional
- Other fields: Optional, no validation

---

### 2. FieldGuidance (Contextual Help)

**Path**: `src/components/create/guidance/FieldGuidance.tsx`

**Purpose**: Display field-specific tips, examples, and best practices

**Behavior**:

- Updates when user focuses on a field
- Shows relevant icon, title, description
- Displays best practices as checklist
- Provides real examples for each field

**Field Types**:

```typescript
type FieldType =
  | 'title'
  | 'description'
  | 'goalAmount'
  | 'currency'
  | 'fundingPurpose'
  | 'bitcoinAddress'
  | 'categories'
  | null;
```

**Example Output** (Title field):

```
┌─────────────────────────────────┐
│ 🎯 Project Title                │
│ Best Practices:                 │
│ ✓ Keep under 60 characters      │
│ ✓ Be specific                   │
│ ✓ Avoid jargon                  │
│                                 │
│ Examples:                       │
│ • Community Garden Project      │
│ • Local Animal Shelter          │
└─────────────────────────────────┘
```

---

### 3. StickyProgress (Progress Indicator)

**Path**: `src/components/create/guidance/StickyProgress.tsx`

**Purpose**: Keep users aware of progress when scrolling

**Behavior**:

- Hidden by default
- Appears after scrolling 200px down
- Shows completion percentage
- Displays mini-checklist (desktop only)
- Replaces main header to save space

**Visual Design**:

```
┌────────────────────────────────────────────┐
│ 🎯 Create Project | 65% complete          │
│ ━━━━━━━━━━━━━━━━━━━━░░░░░░░░              │
│ ✓ Title  ✓ Description  ○ Wallet          │
└────────────────────────────────────────────┘
```

---

### 4. CurrencyConverter

**Path**: `src/components/create/guidance/CurrencyConverter.tsx`

**Purpose**: Help users understand amount equivalents across currencies

**Behavior**:

- Only visible when goal amount > 0
- Shows BTC, SATS, and major fiat equivalents
- Updates in real-time as user types
- Includes disclaimer about BTC-only settlement

**Example**:

```
Amount Breakdown
─────────────────
BTC:  ₿ 0.05102040
SATS: 5,102,040 sats
─────────────────
USD:  $5,000.00
EUR:  €4,693.88
CHF:  CHF 4,489.80

ⓘ Live rates. All donations settle in Bitcoin.
```

---

### 5. Templates (Projects, Assets, Services)

**Paths**:
- `src/components/create/templates/ProjectTemplates.tsx`
- `src/components/create/templates/AssetTemplates.tsx`
- `src/components/create/templates/ServiceTemplates.tsx`

**Purpose**: Reduce blank-page anxiety with pre-filled examples.

**Available (examples)**:
- Projects: Community Garden, Animal Shelter, Art Exhibition, Open Source Project
- Assets: Digital Collectible, Physical Item, Membership Pass
- Services: 1-hour Consultation, Design Sprint, Bug Fix Bundle, Copy Edit, On-site Session

**Behavior**:
- Displayed near the form; click to prefill form defaults.
- Non-destructive; user can edit after applying.
- Reuses `EntityForm` initial values to keep DRY.

---

### 6. MissingWalletBanner

**Path**: `src/components/project/MissingWalletBanner.tsx`

**Purpose**: Convert demo projects into active fundraising campaigns

**Visibility**:

- Only shown to project owners
- Only when both `bitcoin_address` and `lightning_address` are null
- Dismissable (persists in session)

**Actions**:

1. "Add Wallet Address" → Edit page
2. "Get a Wallet First" → /wallets (new tab)

**Visual Design**:

```
┌──────────────────────────────────────────────┐
│ 💼 Add Your Bitcoin Address to Start        │
│    Receiving Donations                       │
│                                              │
│ Your project is live, but you can't         │
│ receive donations yet!                       │
│                                              │
│ [Add Wallet Address] [Get a Wallet First]   │
│                                              │
│ ⓘ Self-custodial: No KYC, no middleman     │
└──────────────────────────────────────────────┘
```

---

## User Flow

### Happy Path (First-Time Creator)

1. **Arrive at /projects/create**
   - See empty form with placeholder text
   - Right sidebar shows "Click on a field to get started"

2. **Click on Title field**
   - Focus detected
   - Right sidebar updates with title guidance
   - User types: "Community Garden Project"
   - Progress bar updates to ~30%

3. **Click on Description field**
   - Sidebar updates with description guidance
   - User writes 2-3 paragraphs
   - Progress bar updates to ~70%

4. **Scroll down**
   - Sticky progress bar appears at top
   - Sidebar remains visible (sticky)

5. **See template examples**
   - Click "Community Garden" template
   - Form prefills with example content
   - Toast: "Template loaded! Edit and make it yours."
   - Scrolls back to top

6. **Edit prefilled content**
   - Customize title, description
   - Adjust goal amount → Currency converter appears
   - Select categories
   - Skip Bitcoin address (will add later)

7. **Click "Create Project"**
   - Validation passes
   - Project created with status: "active"
   - Redirected to /dashboard
   - Draft cleared from localStorage

8. **View project**
   - Navigate to project page
   - See MissingWalletBanner at top
   - Click "Get a Wallet First" → /wallets
   - Learn about wallets, choose provider

9. **Add wallet**
   - Return to project
   - Click "Add Wallet Address"
   - Edit page opens
   - Add Bitcoin address
   - Save → Banner disappears

---

## Technical Details

### Autosave Logic

```typescript
// Save draft every 10 seconds if form has content
useEffect(() => {
  const interval = setInterval(() => {
    const hasContent = formData.title.trim() || formData.description.trim();
    if (hasContent) {
      const key = isEditMode ? `project-edit-${projectId}` : 'project-draft';
      localStorage.setItem(key, JSON.stringify(formData));
    }
  }, 10000);
  return () => clearInterval(interval);
}, [formData, isEditMode, projectId]);
```

### Field Focus Detection

```typescript
const [activeField, setActiveField] = useState<FieldType>(null);

const handleFieldFocus = (field: FieldType) => {
  setActiveField(field);  // Triggers FieldGuidance update
};

// In JSX:
<Input
  onFocus={() => handleFieldFocus('title')}
  // ...
/>
```

### Sticky Behavior

```typescript
// StickyProgress component
useEffect(() => {
  const handleScroll = () => {
    setIsVisible(window.scrollY > 200); // Show after 200px
  };
  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

### Currency Conversion

```typescript
// Mock rates (production: fetch from API)
const MOCK_RATES = {
  BTC_TO_USD: 98000,
  BTC_TO_EUR: 92000,
  BTC_TO_CHF: 88000,
};

// Convert to satoshis (base unit)
const toSatoshis = (): number => {
  switch (fromCurrency) {
    case 'SATS':
      return amount;
    case 'BTC':
      return amount * 100_000_000;
    case 'CHF':
      return (amount / rates.BTC_TO_CHF) * 100_000_000;
    // ...
  }
};
```

---

## Best Practices

### When Adding New Fields

1. **Update FormData interface** in `ProjectWizard.tsx`
2. **Add validation** in `validateField()` function
3. **Create guidance content** in `FieldGuidance.tsx`
4. **Update completion logic** in `getCompletionPercentage()`
5. **Add to API payload** in `handleSubmit()`

### When Modifying Guidance

- Keep tips **actionable** and **concise**
- Use **checkmarks** for positive framing
- Provide **2-3 real examples**
- Update **all field types** in `guidanceContent` object

### Performance Considerations

- Autosave interval: **10 seconds** (balance between UX and performance)
- Sticky threshold: **200px** (appears after user commits to scrolling)
- Currency converter: **Only render when amount > 0**
- Template click: **Smooth scroll to top** (avoid jarring jump)

---

## Integration Points

### API Endpoints

- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update existing project
- `GET /api/projects/:id` - Fetch project details

### External Links

- `/wallets` - Wallet education page (opens in new tab)
- `/project/:id/edit` - Edit project
- `/dashboard` - Post-creation redirect

### LocalStorage Keys

- `project-draft` - New project draft
- `project-edit-${projectId}` - Edit session draft

---

## Future Enhancements

### Phase 2

- [ ] Real-time currency rate API integration
- [ ] Image upload with drag-drop
- [ ] Rich text editor for description
- [ ] Project preview modal
- [ ] A/B test description min-length requirement

### Phase 3

- [ ] Lightning invoice generation
- [ ] Multi-language support
- [ ] Collaborative editing
- [ ] AI-powered title/description suggestions

---

## Troubleshooting

### Issue: Guidance not updating

**Cause**: `activeField` state not changing on focus
**Fix**: Ensure `onFocus={() => handleFieldFocus('fieldName')}` is present on all inputs

### Issue: Progress bar stuck at 0%

**Cause**: `getCompletionPercentage()` logic error
**Fix**: Verify all field weights sum to 100

### Issue: Template not loading

**Cause**: `PROJECT_TEMPLATES` import missing
**Fix**: Check `import { PROJECT_TEMPLATES } from '@/components/create/templates/ProjectTemplates'`

### Issue: Banner always visible

**Cause**: `isOwner` check failing
**Fix**: Verify `project.user_id === user?.id` comparison

---

## Maintenance

### Monthly Tasks

- [ ] Review analytics for drop-off points
- [ ] Update exchange rates in `MOCK_RATES`
- [ ] Test autosave on slow connections
- [ ] Validate guidance content accuracy

### Quarterly Tasks

- [ ] A/B test template effectiveness
- [ ] User interviews on guidance clarity
- [ ] Performance audit (bundle size, render time)
- [ ] Accessibility audit (keyboard nav, screen readers)

---

## Contact

For questions or issues related to the create form:

- Architecture: See this document
- UX decisions: See original requirements in chat
- Code changes: Check git history for context

---

**Last Updated**: 2025-10-30
**Version**: 2.0 (Refactored)
**Status**: ✅ Production Ready
