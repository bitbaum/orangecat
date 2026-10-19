# Step-by-Step: Creating an Apartment Building in OrangeCat

**Scenario:** You want to set up "Sunset Apartments" - a 20-unit residential building in Zurich with shared governance and expenses.

**Time Required:** ~30 minutes  
**What You'll Create:**

1. Building Group (community aspect)
2. Building Asset (property aspect)
3. Link them together
4. Set up governance and features

---

## 🎯 Overview

An apartment building in OrangeCat has **two parts**:

1. **Building Group** - The community of residents
   - Members: All residents
   - Governance: How decisions are made
   - Treasury: Shared expenses (utilities, maintenance)
   - Events: Building meetings, social gatherings

2. **Building Asset** - The physical property
   - Property value
   - Location
   - Documents (deeds, insurance)
   - Can be used as collateral for loans

**They're linked:** The building group owns the building asset.

---

## 📋 Prerequisites

Before starting, ensure:

- ✅ You have an OrangeCat account
- ✅ You're logged in
- ✅ You have a Bitcoin wallet connected (optional, for treasury)

---

## Step 1: Add "Building" as Group Label (One-Time Setup)

**Note:** This is a one-time developer task. Once done, all users can create building groups.

**File:** `src/config/group-labels.ts`

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
      visibility: 'private', // Only residents can see
    },
    suggestedFeatures: ['shared_wallet', 'events', 'proposals'],
    defaultGovernance: 'consensus', // Residents decide together
  },
} as const satisfies Record<string, GroupLabelConfig>;
```

**Time:** 5 minutes  
**Result:** "Building" now appears as an option when creating groups.

---

## Step 2: Create Building Group (Community)

### 2.1 Navigate to Create Group

1. Go to `/groups` page
2. Click **"Create Group"** button
3. You'll see the template selection screen

### 2.2 Select Template (Optional)

You can:

- **Option A:** Select "Residential Building" template (if we add it)
- **Option B:** Click "Start from scratch"

For this example, let's start from scratch.

### 2.3 Fill Out Group Form

**Group Type Section:**

- **Label:** Select **"Building"**
  - This sets smart defaults (private visibility, consensus governance)

**Basic Information:**

- **Group Name:** `Sunset Apartments`
- **Description:**
  ```
  A 20-unit residential building in Zurich.
  Residents share governance and expenses for utilities,
  maintenance, and building improvements.
  ```

**Settings:**

- **Governance Model:** `Consensus` (default for buildings)
  - All residents must agree on major decisions
  - Alternative: `Democratic` (majority vote)
- **Visibility:** `Private` (default for buildings)
  - Only residents can see the group
- **Listed in Directory:** `No` (default)
  - Building groups are private
- **Bitcoin Address:** (Optional)
  - Building treasury address for shared expenses
  - Example: `bc1q...` (multi-sig recommended)
- **Lightning Address:** (Optional)
  - For instant payments
  - Example: `sunset@lightning.address`

### 2.4 Submit

Click **"Create Group"**

**Result:**

- ✅ Building group created
- ✅ You're automatically added as founder
- ✅ Redirected to `/groups/sunset-apartments`

**Time:** ~5 minutes

---

## Step 3: Set Up Building Features

### 3.1 Enable Features

On the group page, go to **Settings** → **Features**

Enable:

- ✅ **Shared Wallet** - For building expenses
- ✅ **Events** - For building meetings
- ✅ **Proposals** - For decision-making
- ✅ **Voting** - If using democratic governance

### 3.2 Configure Treasury

1. Go to **Treasury** section
2. Add Bitcoin address (if not done during creation)
3. Set up multi-signature wallet (recommended)
   - Requires multiple residents to approve spending
   - More secure for building funds

**Time:** ~5 minutes

---

## Step 4: Add Residents (Members)

### 4.1 Invite Residents

1. Go to **Members** section
2. Click **"Invite Member"**
3. Enter resident's email or username
4. Set role: `Member` (all residents are equal)
5. Send invitation

### 4.2 Accept Invitations

Residents receive email invitation:

1. Click invitation link
2. Accept invitation
3. Automatically added as member

### 4.3 Member Roles

- **Founder:** You (building owner/manager)
- **Admin:** (Optional) Building manager
- **Member:** All residents

**Time:** ~10 minutes (depends on number of residents)

---

## Step 5: Create Building Asset (Property)

### 5.1 Navigate to Create Asset

1. Go to `/assets` page
2. Click **"Create Asset"**
3. Select template: **"Real Estate"** (if available)

### 5.2 Fill Out Asset Form

**Basic Information:**

- **Title:** `Sunset Apartments - 123 Main St`
- **Asset Type:** `Real Estate`
- **Description:**
  ```
  20-unit residential apartment building in Zurich.
  Built in 2010, 5 floors, includes parking and storage.
  ```

**Details:**

- **Location:** `Zurich, Switzerland`
- **Estimated Value:** `2500000` (in your preferred currency)
- **Currency:** `CHF` (or USD, EUR, BTC)

**Documents:** (Upload later)

- Property deed
- Insurance documents
- Building permits
- Survey reports

### 5.3 Link to Building Group

**Important:** Set the asset's owner to the building group.

1. In the asset form, look for **"Owner"** field
2. Select: **"Sunset Apartments"** (your building group)
3. This sets the `actor_id` to link group → asset

**Alternative (if UI doesn't support yet):**

- Create asset with your user as owner
- Later, update asset's `actor_id` to building group's actor_id via API

### 5.4 Submit

Click **"Create Asset"**

**Result:**

- ✅ Building asset created
- ✅ Linked to building group
- ✅ Can be used as collateral for loans

**Time:** ~5 minutes

---

## Step 6: Set Up Building Governance

### ⚠️ **Note: Proposals & Voting Not Yet Implemented**

**Current Status:**

- ❌ Proposals feature: Database schema exists, but no service layer/API/UI
- ❌ Voting feature: Database schema exists, but no service layer/API/UI
- ✅ Events: Fully implemented (use for building meetings)
- ✅ Treasury: Fully implemented (manual management)

**Workaround for Now:**

- Use **Events** for building meetings to discuss decisions
- Manually manage treasury (no proposal-driven spending yet)
- Track decisions in event descriptions/notes

**What Will Work (Once Implemented):**

1. Create proposals for decisions
2. Residents vote on proposals
3. Automatic fund release when proposal passes
4. Proposal history tracking

**Time:** N/A (feature not available yet)

---

## Step 7: Use Building Asset for Loans (Optional)

### 7.1 Create Loan Request

1. Go to `/loans` page
2. Click **"Request Loan"**
3. Fill out loan details:
   - **Amount:** `500,000 CHF`
   - **Purpose:** `Building renovations`
   - **Collateral:** Select **"Sunset Apartments - 123 Main St"** asset
4. Submit

### 7.2 Loan Process

- Lenders see your loan request
- They see the building asset as collateral
- Asset value: CHF 2,500,000
- Loan-to-value ratio: 20% (safe for lenders)
- Lenders can offer terms

### 7.3 Loan Approval

- Building group votes on accepting loan
- If approved, loan proceeds to building treasury
- Asset remains as collateral until loan repaid

**Time:** Varies (depends on loan terms)

---

## Step 8: Manage Building Expenses

### ⚠️ **Note: Proposal-Driven Expenses Not Yet Implemented**

**Current Status:**

- ❌ Can't create expense proposals
- ❌ Can't vote on expenses
- ❌ Can't auto-execute approved expenses
- ✅ Treasury exists (manual management)
- ✅ Wallets can be tracked

**Workaround for Now:**

- Manually track expenses in treasury
- Use events to discuss expenses
- Document decisions in event notes
- Manual fund transfers when needed

**What Will Work (Once Implemented):**

1. Create expense proposals
2. Vote on expenses
3. Automatic payment when approved
4. Expense history and reports

**Time:** N/A (feature not available yet)

---

## Step 9: Organize Building Events

### 9.1 Create Building Meeting

1. Go to **Events** section
2. Click **"Create Event"**
3. Fill out:
   - **Title:** `Monthly Building Meeting`
   - **Date:** Next month
   - **Location:** `Building common room`
   - **Description:** `Discuss building matters`
   - **RSVP Required:** Yes
4. Submit

### 9.2 Residents RSVP

- Residents receive notification
- Can RSVP: Going / Not Going / Maybe
- See who's attending

**Time:** ~2 minutes per event

---

## 📊 Complete System Overview

```
┌─────────────────────────────────────────────────┐
│  SUNSET APARTMENTS (Building Group)            │
│                                                 │
│  Members: 20 residents                         │
│  Governance: Consensus                         │
│  Treasury: CHF 50,000                          │
│  Features: Shared wallet, events, proposals    │
│                                                 │
│  Owns → Building Asset                         │
│         ├─ Value: CHF 2,500,000               │
│         ├─ Location: Zurich, Switzerland      │
│         └─ Used as collateral for loans        │
│                                                 │
│  Activities:                                   │
│  ├─ Proposals: 5 active                       │
│  ├─ Events: Monthly meetings                   │
│  └─ Loans: 1 active (CHF 500k)                 │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Key Benefits

### For Residents

- ✅ Transparent governance
- ✅ Shared expense management
- ✅ Building community
- ✅ Democratic decision-making

### For Building Owner

- ✅ Organized community
- ✅ Tracked expenses
- ✅ Property value as asset
- ✅ Can use asset for loans

### For Lenders

- ✅ Real estate as collateral
- ✅ Transparent building finances
- ✅ Lower risk (secured loans)

---

## 🔧 Advanced Features

### Multi-Signature Treasury

- Require 3 of 5 residents to approve spending
- More secure for large amounts
- Set up via Bitcoin wallet

### Automated Expenses

- Recurring proposals (monthly utilities)
- Auto-create, vote, execute
- Reduces manual work

### Building Reports

- Monthly financial reports
- Expense breakdowns
- Member activity

### Integration with Services

- Link to utility providers
- Automatic expense tracking
- Payment automation

---

## 📝 Checklist

- [ ] Add "building" label to config (developer)
- [x] Create building group
- [x] Set up governance model
- [x] Enable features (wallet, events) ⚠️ Proposals not available yet
- [x] Add residents/members
- [x] Create building asset
- [x] Link asset to group
- [x] Set up treasury (Bitcoin address)
- [ ] Create first proposal ⚠️ **Not implemented yet**
- [x] Organize first event
- [ ] (Optional) Use asset for loan

---

## ⏱️ Total Time

- **Initial Setup:** ~30 minutes
- **Adding Members:** ~10 minutes (per resident)
- **Ongoing Management:** ~1 hour/month

## ⚠️ Implementation Status

**What Works:**

- ✅ Create building group
- ✅ Add members/residents
- ✅ Create building asset
- ✅ Link asset to group
- ✅ Set up treasury
- ✅ Create events (meetings)
- ✅ Invite members

**What Doesn't Work Yet:**

- ❌ Create proposals (database exists, but no service/API/UI)
- ❌ Vote on proposals (database exists, but no service/API/UI)
- ❌ Execute proposals (automatic fund release)

**See:** `docs/archive/development/GROUP_FEATURES_IMPLEMENTATION_STATUS.md` for the status as of 2025-12-30 (archived; re-verify)

---

## 💡 Tips

1. **Start Small:** Begin with basic features, add more as needed
2. **Clear Communication:** Use proposals and events to keep residents informed
3. **Transparency:** Make all expenses visible to build trust
4. **Security:** Use multi-sig for treasury (especially for large amounts)
5. **Documentation:** Keep building documents in asset records

---

**Last Updated:** 2025-12-30
