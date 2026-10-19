# Quick Start: Creating an Apartment Building

**Visual Guide:** Step-by-step user journey

---

## 🎬 The Journey

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Create Building Group                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Navigate to /groups]                                      │
│         │                                                    │
│         ▼                                                    │
│  [Click "Create Group"]                                      │
│         │                                                    │
│         ▼                                                    │
│  [Template Selection Screen]                                 │
│  ┌──────────────────────────────────────┐                  │
│  │  Choose Template:                    │                  │
│  │  ☐ Residential Building              │                  │
│  │  ☐ Start from scratch                 │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  [Group Creation Form]                                      │
│  ┌──────────────────────────────────────┐                  │
│  │  Group Type: [Building ▼]            │                  │
│  │  Name: [Sunset Apartments]           │                  │
│  │  Description: [20-unit building...]  │                  │
│  │  Governance: [Consensus ▼]          │                  │
│  │  Visibility: [Private ▼]            │                  │
│  │  Bitcoin Address: [bc1q...]         │                  │
│  │                                      │                  │
│  │  [Create Group]                      │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  ✅ Group Created!                                          │
│  Redirected to: /groups/sunset-apartments                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Set Up Features                                     │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [On Group Page]                                            │
│         │                                                    │
│         ▼                                                    │
│  [Settings → Features]                                      │
│  ┌──────────────────────────────────────┐                  │
│  │  Enable Features:                    │                  │
│  │  ☑ Shared Wallet                     │                  │
│  │  ☑ Events                            │                  │
│  │  ☑ Proposals                         │                  │
│  │  ☑ Voting                            │                  │
│  │                                      │                  │
│  │  [Save]                              │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Add Residents                                       │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Members Section]                                          │
│         │                                                    │
│         ▼                                                    │
│  [Click "Invite Member"]                                    │
│  ┌──────────────────────────────────────┐                  │
│  │  Invite Resident:                    │                  │
│  │  Email: [resident@example.com]       │                  │
│  │  Role: [Member ▼]                    │                  │
│  │                                      │                  │
│  │  [Send Invitation]                   │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  [Resident receives email]                                  │
│         │                                                    │
│         ▼                                                    │
│  [Resident clicks link → Accepts]                           │
│         │                                                    │
│         ▼                                                    │
│  ✅ Resident added as member                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Create Building Asset                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Navigate to /assets]                                      │
│         │                                                    │
│         ▼                                                    │
│  [Click "Create Asset"]                                     │
│         │                                                    │
│         ▼                                                    │
│  [Asset Creation Form]                                      │
│  ┌──────────────────────────────────────┐                  │
│  │  Title: [Sunset Apartments - 123...] │                  │
│  │  Type: [Real Estate ▼]               │                  │
│  │  Description: [20-unit building...]  │                  │
│  │  Location: [Zurich, Switzerland]     │                  │
│  │  Value: [2500000]                    │                  │
│  │  Currency: [CHF ▼]                  │                  │
│  │  Owner: [Sunset Apartments Group ▼]  │ ← Link to group │
│  │                                      │                  │
│  │  [Create Asset]                      │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  ✅ Asset Created!                                          │
│  Linked to building group                                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  STEP 5: Create First Proposal                              │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  [Proposals Section]                                        │
│         │                                                    │
│         ▼                                                    │
│  [Click "Create Proposal"]                                  │
│  ┌──────────────────────────────────────┐                  │
│  │  Title: [Monthly Maintenance Budget] │                  │
│  │  Description: [CHF 5,000 for...]     │                  │
│  │  Type: [Spending ▼]                  │                  │
│  │  Amount: [5000]                      │                  │
│  │                                      │                  │
│  │  [Create Proposal]                   │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  [Residents vote]                                           │
│  ┌──────────────────────────────────────┐                  │
│  │  Monthly Maintenance Budget          │                  │
│  │  ─────────────────────────────────── │                  │
│  │  ☑ You (Founder)                    │                  │
│  │  ☑ Resident 1                        │                  │
│  │  ☑ Resident 2                        │                  │
│  │  ☐ Resident 3 (pending)              │                  │
│  │                                      │                  │
│  │  Status: 3/20 votes (Consensus)      │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         ▼                                                    │
│  ✅ Proposal Approved!                                      │
│  Funds released from treasury                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 Actual UI Flow

### Screen 1: Groups Dashboard

```
┌─────────────────────────────────────────┐
│  Groups                          [+ Create Group] │
├─────────────────────────────────────────┤
│                                         │
│  My Groups (0)                          │
│  ┌─────────────────────────────────┐   │
│  │  No groups yet                   │   │
│  │  Create your first group         │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Discover (12)                          │
│  [List of public groups...]             │
└─────────────────────────────────────────┘
```

### Screen 2: Create Group - Template Selection

```
┌─────────────────────────────────────────┐
│  Create Group                            │
│  Start a new group, circle, or           │
│  organization                           │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Network  │  │   DAO    │            │
│  │  State   │  │          │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Building │  │  Family   │            │
│  │          │  │  Circle   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  Or start from scratch →                │
└─────────────────────────────────────────┘
```

### Screen 3: Create Group - Form

```
┌─────────────────────────────────────────┐
│  Create New Group                        │
│  Choose a label and configure your group │
├─────────────────────────────────────────┤
│                                         │
│  Group Type                              │
│  ┌─────────────────────────────────┐   │
│  │ Label: [Building ▼]             │   │
│  │                                  │   │
│  │ ℹ️ Labels influence defaults    │   │
│  │    but don't restrict           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Basic Information                       │
│  ┌─────────────────────────────────┐   │
│  │ Name: [Sunset Apartments]       │   │
│  │                                  │   │
│  │ Description:                    │   │
│  │ [20-unit residential building...]│   │
│  └─────────────────────────────────┘   │
│                                         │
│  Settings                                │
│  ┌─────────────────────────────────┐   │
│  │ Governance: [Consensus ▼]       │   │
│  │ Visibility: [Private ▼]        │   │
│  │ Listed: [☐]                     │   │
│  │ Bitcoin: [bc1q...]              │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Cancel]  [Create Group]               │
└─────────────────────────────────────────┘
```

### Screen 4: Group Page (After Creation)

```
┌─────────────────────────────────────────┐
│  Sunset Apartments              [Settings]│
│  Building • Private                      │
├─────────────────────────────────────────┤
│                                         │
│  [Overview] [Members] [Treasury]        │
│  [Proposals] [Events] [Assets]          │
│                                         │
│  Members: 1                              │
│  Treasury: 0 CHF                          │
│  Active Proposals: 0                     │
│                                         │
│  Quick Actions:                        │
│  [+ Invite Member]  [+ Create Proposal]  │
│  [+ Create Event]   [+ Add Asset]       │
└─────────────────────────────────────────┘
```

---

## 🎯 Key Actions Summary

| Action              | Location                          | Time       |
| ------------------- | --------------------------------- | ---------- |
| **Create Group**    | `/groups` → "Create Group"        | 5 min      |
| **Add Members**     | Group page → Members → "Invite"   | 2 min each |
| **Create Asset**    | `/assets` → "Create Asset"        | 5 min      |
| **Link Asset**      | Asset form → Owner field          | 1 min      |
| **Create Proposal** | Group page → Proposals → "Create" | 3 min      |
| **Create Event**    | Group page → Events → "Create"    | 2 min      |

---

## 💡 Pro Tips

1. **Use Templates:** Select "Residential Building" template for pre-filled defaults
2. **Multi-Sig Treasury:** Set up 3-of-5 multi-sig for building funds
3. **Recurring Proposals:** Create monthly utility payment proposals
4. **Event Reminders:** Set up recurring building meetings
5. **Asset Documents:** Upload all building documents to asset record

---

**See full guide:** `CREATING_APARTMENT_BUILDING.md`
