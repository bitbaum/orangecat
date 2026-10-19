# Project Create Form - Quick Reference

created_date: 2024-11-15  
last_modified_date: 2025-12-05  
last_modified_summary: Added asset and loan quick-start templates and enabled form re-prefill hooks

## What Changed

### Before (Old Form)

- ❌ Multi-step wizard causing drop-off
- ❌ No contextual help - users guessing
- ❌ Bitcoin address required (blocker for demo)
- ❌ No inspiration/templates
- ❌ No post-creation wallet prompt
- ❌ Static progress indicator

### After (New Form)

- ✅ Single-page form - no steps
- ✅ Contextual guidance sidebar (updates per field)
- ✅ Sticky progress indicator (appears on scroll)
- ✅ Bitcoin address optional ("add later")
- ✅ Currency converter (BTC/SATS/Fiat)
- ✅ 4 pre-filled templates for inspiration
- ✅ "Get a wallet" link to /wallets
- ✅ Banner on project page when wallet missing

---

## New Components

```
📁 src/components/create/
  📁 guidance/
    📄 FieldGuidance.tsx        → Contextual help sidebar
    📄 StickyProgress.tsx       → Sticky progress bar
    📄 CurrencyConverter.tsx    → BTC/SATS/Fiat converter
    📄 index.ts
  📁 templates/
    📄 ProjectTemplates.tsx     → Pre-filled examples
    📄 AssetTemplates.tsx       → Prefill asset forms with real-world examples
  📁 loans/
    📄 LoanTemplates.tsx        → Quick-fill presets for loan dialog

📁 src/components/project/
  📄 MissingWalletBanner.tsx    → Post-creation wallet prompt
```

---

## Key Features

### 1. Contextual Guidance

**When**: User focuses on any field
**What**: Sidebar updates with field-specific tips, examples, best practices
**Why**: Reduce cognitive load, increase completion rate

### 2. Sticky Progress

**When**: User scrolls down >200px
**What**: Compact progress bar sticks to top
**Why**: Maintain context, motivate completion

### 3. Currency Converter

**When**: Goal amount > 0
**What**: Real-time BTC/SATS/Fiat equivalents
**Why**: Transparency (BTC-only platform, fiat for display)

### 4. Templates

**When**: Always visible below form
**What**: 4 click-to-load examples
**Why**: Inspiration, reduce blank-page anxiety

### 5. Wallet Links

**When**: Bitcoin address field
**What**: "Don't have a wallet? Get one" → /wallets
**Why**: Remove blocker, educate users

### 6. Missing Wallet Banner

**When**: Project created without wallet
**What**: Prominent banner on project page
**Why**: Convert demo → active fundraiser

---

## User Journey

```
1. Land on /projects/create
   └─> See empty form + "Click a field to get started"

2. Click Title field
   └─> Sidebar shows title guidance + examples

3. Type title, description
   └─> Progress bar updates (30% → 70%)

4. Scroll down
   └─> Sticky progress bar appears
   └─> Sidebar stays visible (sticky)

5. See templates
   └─> Click "Community Garden"
   └─> Form prefills, scrolls to top

6. Edit content
   └─> Adjust goal → Currency converter appears
   └─> Skip Bitcoin address

7. Click "Create Project"
   └─> Project created (no blocker!)
   └─> Redirected to dashboard

8. View project
   └─> See banner: "Add wallet to receive donations"
   └─> Click "Get a wallet first" → /wallets

9. Learn about wallets
   └─> Choose provider, get address

10. Return & add wallet
    └─> Banner disappears
    └─> Ready to receive donations!
```

---

## Tech Stack

- **React** - Component library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Next.js** - Framework
- **LocalStorage** - Autosave drafts
- **Lucide React** - Icons

---

## File Locations

### Main Form

`src/components/wizard/ProjectWizard.tsx`

### Guidance Components

`src/components/create/guidance/`

### Templates

`src/components/create/templates/ProjectTemplates.tsx`

### Wallet Banner

`src/components/project/MissingWalletBanner.tsx`

### Pages

- Create: `src/app/projects/create/page.tsx`
- Project Detail: `src/app/projects/[id]/page.tsx` (unified route)
- Wallets: `src/app/wallets/page.tsx`

---

## Quick Stats

| Metric            | Before | After   |
| ----------------- | ------ | ------- |
| Form steps        | 4      | 1       |
| Required fields   | 5      | 2       |
| Contextual help   | None   | Dynamic |
| Templates         | 0      | 4       |
| Wallet blocker    | Yes    | No      |
| Progress tracking | Static | Sticky  |

---

## Testing Checklist

- [ ] Create project without wallet → Banner shows
- [ ] Add wallet later → Banner disappears
- [ ] Click field → Sidebar updates
- [ ] Scroll down → Sticky progress appears
- [ ] Add goal → Converter shows
- [ ] Click template → Form prefills
- [ ] Leave page → Draft autosaves
- [ ] Return → Draft restores
- [ ] Submit form → Redirects to dashboard
- [ ] View project → See correct data

---

## Next Steps

1. **Test in development**: `npm run dev`
2. **Monitor conversion**: Track completion rates
3. **Gather feedback**: User interviews
4. **Iterate**: A/B test description length, etc.

---

## Questions?

See `docs/CREATE_FORM_ARCHITECTURE.md` for deep technical details.
