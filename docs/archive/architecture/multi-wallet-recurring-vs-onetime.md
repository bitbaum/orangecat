# Multi-Wallet System: Recurring Budgets vs One-Time Goals

## Executive Summary

This document outlines the implementation strategy for distinguishing between **recurring budgets** (flow-through wallets like rent, food) and **one-time savings goals** (accumulation wallets like saving for a laptop, car) in the multi-wallet system.

---

## 1. BUSINESS CASE

### Problem Statement

Users have fundamentally different financial behaviors:

- **Recurring expenses**: Money flows in and out regularly (monthly rent, weekly groceries)
- **One-time purchases**: Accumulate funds toward a specific goal, then spend once

Treating these the same creates poor UX and missed engagement opportunities.

### Market Opportunity

#### For Individual Users:

- **Budget Management**: 64% of Americans live paycheck-to-paycheck and need better spending tracking
- **Savings Goals**: 76% of millennials set financial goals but lack tools to track them visually
- **Privacy**: Users want separate wallets for different contexts (work, personal, donations)
- **Financial Literacy**: Visual progress tracking teaches better money habits

#### For Project Fundraisers:

- **Transparency**: Donors want to see exactly where their money goes
- **Multiple Campaigns**: Run separate fundraisers for different project phases
- **Social Proof**: Public goals with progress bars increase contribution rates by 40%
- **Accountability**: Clear separation of funds builds trust

### Revenue Streams

1. **Freemium Model**: 3 free wallets, $5/mo for unlimited
2. **Premium Analytics**: $10/mo for spending insights and CSV exports
3. **White-Label API**: $500/mo for businesses to integrate
4. **Goal Boosting**: Users pay to feature their public goals ($20/month)
5. **Social Features**: Contributor badges and leaderboards (gamification)

### Competitive Advantages

- **Bitcoin-Native**: No KYC, true ownership
- **xpub Support**: Automatic address generation for enhanced privacy
- **Social Funding**: Friends can contribute to public goals
- **Real-Time Blockchain Data**: Mempool.space integration

---

## 2. UX/UI DESIGN STRATEGY

### A. Core Principles

1. **Visual Distinction**: Users should immediately recognize wallet type by color/icon
2. **Contextual UI**: Show relevant metrics (budget usage vs goal progress)
3. **Celebration Moments**: Milestone achievements create emotional connection
4. **Progressive Disclosure**: Collapsed cards reduce overwhelm, expand for details
5. **Mobile-First**: Swipe actions, bottom sheets, one-tap interactions

### B. Wallet Type Selection

**Entry Point**: "Add Wallet" button shows three options:

```
┌─────────────────────────────────────┐
│ 🔄 Recurring Budget                 │
│ Monthly expenses that repeat        │
│ Examples: Rent, Food, Gas           │
│ ✓ Set budget limits                 │
│ ✓ Track spending rate               │
│ ✓ Get overspending alerts           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🎯 One-Time Savings Goal            │
│ Save for a specific purchase        │
│ Examples: Laptop, Car, Vacation     │
│ ✓ Set target amount & deadline      │
│ ✓ Track progress to goal            │
│ ✓ Celebrate milestones              │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 💰 General Wallet                   │
│ No specific budget or goal          │
│ Examples: Savings, Donations        │
│ ✓ Simple balance tracking           │
│ ✓ Flexible usage                    │
└─────────────────────────────────────┘
```

### C. Recurring Budget Card Layout

**Key Metrics Shown:**

- Current period progress bar (e.g., "Dec 1-31")
- Amount spent / Budget amount
- Percentage used
- Days remaining in period
- Daily average spending
- Projected end-of-period total
- Status indicator (on track, warning, over budget)

**Color Coding:**

- Green: Under 70% of budget
- Yellow: 70-90% of budget (warning)
- Red: Over 90% or exceeded budget

**Interactions:**

- Tap to expand: Shows transaction history for current period
- "View History" button: Shows past 6-12 budget periods
- "Adjust Budget" button: Modify budget amount for next period

### D. One-Time Goal Card Layout

**Key Metrics Shown:**

- Linear progress bar with percentage
- Current amount / Goal amount
- Days until deadline
- Amount needed per day to reach goal
- Milestone indicators (25%, 50%, 75%, 100%)
- Recent deposits/contributions

**Color Coding:**

- Blue: Active, on track
- Green: Goal reached!
- Purple: Purchased/completed
- Gray: Paused or archived

**Interactions:**

- Tap to expand: Shows full deposit history
- "Add Funds" button: Quick add money
- "Share Goal" button: Make public and get contribution link
- "Mark as Purchased" button: Celebrate completion

### E. Goal Completion Celebration

When 100% milestone is reached:

```
┌──────────────────────────────────────┐
│        🎉 🎊 🎉 🎊 🎉                │
│                                       │
│     Goal Reached!                     │
│                                       │
│  You saved $3,000 for                │
│      MacBook Pro M3                   │
│                                       │
│  Started: Nov 1, 2025                │
│  Completed: Dec 16, 2025              │
│  (29 days ahead of schedule!)        │
│                                       │
│  [Mark as Purchased]                 │
│  [Share Achievement]                 │
│  [Keep Saving]                       │
│                                       │
└──────────────────────────────────────┘
```

### F. Dashboard Organization

**Three Sections:**

1. **Recurring Budgets**: Sorted by urgency (end of period approaching)
2. **Savings Goals**: Sorted by progress (closest to completion first)
3. **General Wallets**: Sorted by balance (highest first)

**Filters:**

- All / Recurring / Goals / General
- Active / Archived
- Search by name

---

## 3. DATABASE SCHEMA IMPLEMENTATION

### A. Migration Overview

**File**: `/supabase/migrations/20251117000000_add_wallet_behavior_types.sql`

**Key Changes:**

1. **Added `behavior_type` field** to `wallets` table
   - `general` | `recurring_budget` | `one_time_goal`

2. **Recurring Budget Fields:**
   - `budget_amount`, `budget_currency`, `budget_period`
   - `current_period_start`, `current_period_end`
   - `current_period_spent`
   - `alert_threshold_percent`, `alert_sent_at`

3. **One-Time Goal Fields:**
   - `goal_status` (active, paused, reached, purchased, cancelled, archived)
   - `goal_reached_at`, `goal_purchased_at`, `purchase_notes`
   - `milestone_25/50/75/100_reached_at`
   - `is_public_goal`, `allow_contributions`, `contribution_count`

4. **New Tables:**
   - `budget_periods`: Historical tracking of budget cycles
   - `goal_milestones`: Celebration tracking for achievements
   - `wallet_contributions`: Social funding from friends/community

5. **Database Functions:**
   - `initialize_wallet_period()`: Auto-create budget periods
   - `check_goal_milestones()`: Trigger milestone celebrations
   - `reset_expired_budget_periods()`: Cron job to reset monthly budgets

### B. Enhanced View

```sql
CREATE VIEW wallets_with_totals AS
SELECT
  w.*,
  -- Budget usage (recurring)
  CASE WHEN behavior_type = 'recurring_budget'
    THEN (current_period_spent / budget_amount * 100)
  END as budget_usage_percent,

  -- Goal progress (one-time)
  CASE WHEN behavior_type = 'one_time_goal'
    THEN (balance_btc / goal_amount * 100)
  END as goal_progress_percent,

  -- Time remaining
  EXTRACT(DAY FROM (current_period_end - now())) as budget_days_remaining,
  EXTRACT(DAY FROM (goal_deadline - now())) as goal_days_remaining,

  -- Daily savings needed
  (goal_amount - balance_btc) /
    GREATEST(EXTRACT(DAY FROM (goal_deadline - now())), 1)
  as daily_savings_needed
FROM wallets w;
```

### C. Row Level Security

All new tables inherit wallet ownership checks:

- Users can see their own wallets
- Public can see wallets for public goals
- Public can contribute to wallets with `allow_contributions = true`

---

## 4. FRONTEND IMPLEMENTATION

### A. TypeScript Types

**Updated**: `/src/types/wallet.ts`

**New Types:**

```typescript
export type WalletBehaviorType = 'general' | 'recurring_budget' | 'one_time_goal';
export type BudgetPeriod = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';
export type GoalStatus = 'active' | 'paused' | 'reached' | 'purchased' | 'cancelled' | 'archived';
```

**Extended Wallet Interface:**

```typescript
export interface Wallet {
  // ... existing fields
  behavior_type: WalletBehaviorType;

  // Recurring budget fields
  budget_amount: number | null;
  budget_period: BudgetPeriod | null;
  current_period_spent: number | null;

  // One-time goal fields
  goal_status: GoalStatus | null;
  milestone_25_reached_at: string | null;
  // ... etc
}
```

**New Helper Functions:**

- `getWalletBehaviorInfo()`: Returns display info for behavior type
- `getBudgetPeriodInfo()`: Returns display info for budget period
- `getDaysRemaining()`: Calculates days until deadline
- `getDailyAmountNeeded()`: Calculates required daily savings
- `isOverBudget()`: Checks if spending exceeded budget
- `reachedAlertThreshold()`: Checks if alert should be sent
- `checkMilestone()`: Verifies milestone achievement

### B. React Components to Create

**1. Wallet Type Selector** (`/src/components/wallet/WalletTypeSelector.tsx`)

- Three-option card picker
- Shows examples and benefits
- Routes to appropriate form

**2. Recurring Budget Form** (`/src/components/wallet/RecurringBudgetForm.tsx`)

- Budget amount input
- Period selector (daily, weekly, monthly, etc.)
- Alert threshold slider
- Bitcoin address/xpub input

**3. One-Time Goal Form** (`/src/components/wallet/OneTimeGoalForm.tsx`)

- Goal name and amount
- Target deadline (optional)
- Public goal toggle
- Allow contributions toggle
- Bitcoin address/xpub input

**4. Recurring Budget Card** (`/src/components/wallet/RecurringBudgetCard.tsx`)

- Current period progress bar
- Spending stats (daily average, projected)
- Alert indicators
- Transaction list for current period

**5. One-Time Goal Card** (`/src/components/wallet/OneTimeGoalCard.tsx`)

- Progress bar with milestones
- Days remaining
- Daily savings needed
- Contribution list (if public)
- Celebration animation on 100%

**6. Goal Completion Modal** (`/src/components/wallet/GoalCompletionModal.tsx`)

- Celebration animation
- Stats summary (time taken, total saved)
- Action buttons (mark purchased, share, keep saving)
- Social sharing (Twitter, LinkedIn)

**7. Budget Period History** (`/src/components/wallet/BudgetPeriodHistory.tsx`)

- Chart showing past 6-12 periods
- Overspending trends
- Average spending per period
- Export to CSV

### C. React Hooks

**1. `useBudgetPeriod(walletId)`**

```typescript
export function useBudgetPeriod(walletId: string) {
  const { data: currentPeriod, isLoading } = useQuery({
    queryKey: ['budget-period', walletId],
    queryFn: () => fetch(`/api/wallets/${walletId}/budget-period`).then(r => r.json()),
  });

  const budgetUsagePercent = (currentPeriod?.amount_spent / currentPeriod?.budget_amount) * 100;
  const daysRemaining = getDaysRemaining(currentPeriod?.period_end);
  const isOverBudget = currentPeriod?.amount_spent > currentPeriod?.budget_amount;

  return { currentPeriod, budgetUsagePercent, daysRemaining, isOverBudget, isLoading };
}
```

**2. `useGoalProgress(walletId)`**

```typescript
export function useGoalProgress(walletId: string) {
  const { data: wallet } = useQuery({
    queryKey: ['wallet', walletId],
    queryFn: () => fetch(`/api/wallets/${walletId}`).then(r => r.json()),
  });

  const progressPercent = (wallet?.balance_btc / wallet?.goal_amount) * 100;
  const amountRemaining = wallet?.goal_amount - wallet?.balance_btc;
  const daysRemaining = wallet?.goal_deadline ? getDaysRemaining(wallet.goal_deadline) : null;
  const dailyNeeded = daysRemaining ? amountRemaining / daysRemaining : null;

  const milestones = [
    { percent: 25, reached: !!wallet?.milestone_25_reached_at },
    { percent: 50, reached: !!wallet?.milestone_50_reached_at },
    { percent: 75, reached: !!wallet?.milestone_75_reached_at },
    { percent: 100, reached: !!wallet?.milestone_100_reached_at },
  ];

  return { progressPercent, amountRemaining, daysRemaining, dailyNeeded, milestones };
}
```

---

## 5. BACKEND API CHANGES

### A. Enhanced POST /api/wallets

**Before:**

```json
{
  "label": "My Wallet",
  "address_or_xpub": "bc1q...",
  "category": "general",
  "goal_amount": 1000
}
```

**After (Recurring Budget):**

```json
{
  "label": "Food Budget",
  "address_or_xpub": "bc1q...",
  "category": "food",
  "behavior_type": "recurring_budget",
  "budget_amount": 500,
  "budget_currency": "USD",
  "budget_period": "monthly",
  "alert_threshold_percent": 80
}
```

**After (One-Time Goal):**

```json
{
  "label": "MacBook Pro",
  "address_or_xpub": "bc1q...",
  "category": "general",
  "behavior_type": "one_time_goal",
  "goal_amount": 3000,
  "goal_currency": "USD",
  "goal_deadline": "2026-03-15",
  "is_public_goal": true,
  "allow_contributions": true
}
```

### B. New Endpoints

**GET /api/wallets/:id/budget-period**

- Returns current budget period info
- Includes spending stats (daily average, largest transaction)

**GET /api/wallets/:id/budget-history**

- Returns past budget periods
- Query params: `?limit=12&offset=0`

**POST /api/wallets/:id/mark-purchased**

- Marks one-time goal as purchased
- Body: `{ "purchase_notes": "Bought from Apple Store" }`
- Updates `goal_status` to 'purchased'
- Sets `goal_purchased_at` timestamp

**GET /api/wallets/:id/milestones**

- Returns milestone achievements
- Shows timestamps and celebration status

**POST /api/wallets/:id/contribute**

- Allows others to contribute to public goals
- Body: `{ "amount_btc": 0.001, "message": "Good luck!", "is_anonymous": false }`
- Records contribution in `wallet_contributions` table

**GET /api/wallets/:id/contributors**

- Returns list of contributors (if public goal)
- Respects `is_anonymous` and `public_visibility` flags

### C. Webhook Integration

**Budget Alert Webhook:**

- Triggers when `alert_threshold_percent` is reached
- Sends notification (email, push, in-app)
- Sets `alert_sent_at` to prevent duplicates

**Milestone Webhook:**

- Triggers on 25%, 50%, 75%, 100% milestones
- Sends celebration notification
- Optional: Share on social media (with user permission)

**Period Reset Webhook:**

- Runs daily via cron job
- Calls `reset_expired_budget_periods()`
- Sends "Your budget has reset" notification

### D. Backend Service Functions

**File**: `/src/services/walletBehavior.ts`

```typescript
export async function checkBudgetStatus(walletId: string): Promise<BudgetStatus> {
  // Fetch wallet and current period
  // Calculate usage percentage
  // Check if over budget or near threshold
  // Return status with recommendations
}

export async function calculateGoalProjection(walletId: string): Promise<GoalProjection> {
  // Analyze deposit pattern (weekly, biweekly, etc.)
  // Project when goal will be reached
  // Calculate if on track for deadline
  // Return projection with confidence score
}

export async function resetBudgetPeriod(walletId: string): Promise<void> {
  // Complete current period
  // Create new period
  // Reset spending counter
  // Send notification
}

export async function celebrateMilestone(
  walletId: string,
  milestonePercent: number
): Promise<void> {
  // Mark milestone as celebrated
  // Send notification
  // Generate shareable image
  // Optional: Post to social media
}
```

---

## 6. xpub INTEGRATION FOR TRANSACTION TRACKING

### Problem Statement

With **extended public keys (xpub/ypub/zpub)**, wallets can generate unlimited addresses for privacy. This is critical for:

- Recurring budgets: Each payment gets a fresh address
- Public goals: Contributors send to unique addresses
- Privacy: No address reuse, no transaction linking

### Implementation Strategy

#### A. Address Derivation

**BIP32/BIP44 Derivation Path:**

- `m/84'/0'/0'/0/n` (native segwit, zpub)
- `m/49'/0'/0'/0/n` (nested segwit, ypub)
- `m/44'/0'/0'/0/n` (legacy, xpub)

**Gap Limit**: Check 20 unused addresses for transactions

**Database Tracking:**

```sql
SELECT * FROM wallet_addresses
WHERE wallet_id = 'xxx'
ORDER BY derivation_index;
```

#### B. Transaction Discovery

**Process:**

1. User provides xpub
2. Backend derives first 20 addresses (index 0-19)
3. Query Mempool.space for each address
4. If address has transactions, mark as `is_used = true`
5. Continue deriving until 20 consecutive unused addresses found (gap limit)
6. Store all derived addresses in `wallet_addresses` table

**Mempool.space API:**

```typescript
// Get all transactions for an address
GET https://mempool.space/api/address/{address}/txs

// Get address stats (balance, tx count)
GET https://mempool.space/api/address/{address}
```

#### C. Balance Aggregation

**For recurring budgets:**

- Sum balances of all derived addresses
- Subtract `current_period_spent` to show budget remaining
- Display transaction list filtered by current period

**For one-time goals:**

- Sum balances = progress toward goal
- Each deposit = milestone check
- Display full transaction history

#### D. Privacy Considerations

**Best Practices:**

- Generate new address for each transaction
- Show "Next unused address" button on wallet card
- Never reuse addresses
- Recommend BIP47 (Payment Codes) for recurring donations

---

## 7. BUSINESS LOGIC FLOWS

### Flow 1: Creating a Recurring Budget

```mermaid
User clicks "Add Wallet"
  → Select "Recurring Budget"
  → Fill form (name, budget amount, period, xpub)
  → Submit
  → Backend validates
  → Create wallet record with behavior_type = 'recurring_budget'
  → Trigger initialize_wallet_period()
    → Set current_period_start = now()
    → Set current_period_end = now() + 1 month
    → Create budget_periods record
  → Return wallet to frontend
  → Show success message
  → Redirect to wallet dashboard
```

### Flow 2: Budget Period Reset (Automated)

```mermaid
Cron job runs daily at midnight
  → Call reset_expired_budget_periods()
  → Find all wallets where current_period_end < now()
  → For each expired budget:
    → Mark current budget_periods record as 'completed'
    → Calculate completion_rate (spent / budget * 100)
    → Update wallet:
      → current_period_start = old current_period_end
      → current_period_end = new end date (+ 1 month)
      → current_period_spent = 0
      → alert_sent_at = NULL
    → Create new budget_periods record
    → Send notification to user: "Your budget has reset"
```

### Flow 3: Reaching a Goal Milestone

```mermaid
User receives Bitcoin to wallet address
  → Webhook from Mempool.space detects transaction
  → Backend updates balance_btc
  → Trigger check_goal_milestones()
  → Calculate progress: (balance / goal_amount) * 100
  → If progress >= 25% AND milestone_25_reached_at IS NULL:
    → Set milestone_25_reached_at = now()
    → Insert into goal_milestones table
    → Send celebration notification
    → Frontend shows confetti animation
  → Repeat for 50%, 75%, 100%
  → If 100% reached:
    → Set goal_status = 'reached'
    → goal_reached_at = now()
    → Show "Goal Reached!" modal with action buttons
```

### Flow 4: Contributing to a Public Goal

```mermaid
User A shares public goal link
  → User B visits link
  → Sees goal details (name, amount, progress)
  → Clicks "Contribute"
  → Enter amount and optional message
  → Backend generates new unused address (via get_next_unused_address())
  → Show QR code and address to User B
  → User B sends Bitcoin
  → Blockchain confirms transaction
  → Backend detects payment
    → Update wallet balance
    → Insert into wallet_contributions table
    → Increment contribution_count
    → Check for milestones
    → Send thank-you notification to User A
    → Send confirmation to User B
```

---

## 8. TESTING CHECKLIST

### Unit Tests

- [ ] `validateWalletFormData()` with recurring budget data
- [ ] `validateWalletFormData()` with one-time goal data
- [ ] `getDaysRemaining()` with various dates
- [ ] `getDailyAmountNeeded()` edge cases (negative days, already reached)
- [ ] `isOverBudget()` logic
- [ ] `reachedAlertThreshold()` with different percentages
- [ ] `checkMilestone()` boundary conditions

### Integration Tests

- [ ] Create recurring budget wallet via API
- [ ] Create one-time goal wallet via API
- [ ] Refresh balance triggers milestone check
- [ ] Budget period auto-reset (test cron function)
- [ ] Contribute to public goal
- [ ] Mark goal as purchased
- [ ] Archive completed goal

### E2E Tests

- [ ] User creates food budget, sets $500/month limit
- [ ] User receives Bitcoin, spending increases
- [ ] Alert triggered at 80% threshold
- [ ] Budget resets on 1st of month
- [ ] User creates laptop goal, sets $3000 target
- [ ] User deposits Bitcoin, reaches 25% milestone
- [ ] Celebration modal appears
- [ ] User shares goal publicly
- [ ] Friend contributes to goal
- [ ] Goal reaches 100%, user marks as purchased

---

## 9. DEPLOYMENT PLAN

### Phase 1: Database Migration (Week 1)

- [ ] Run migration on staging environment
- [ ] Verify triggers work correctly
- [ ] Test RLS policies
- [ ] Migrate existing wallets (all become 'general' type initially)

### Phase 2: Backend API (Week 2)

- [ ] Update API endpoints
- [ ] Add validation for new fields
- [ ] Implement budget period logic
- [ ] Set up cron job for period resets
- [ ] Test webhook integrations

### Phase 3: Frontend Components (Week 3-4)

- [ ] Create wallet type selector
- [ ] Build recurring budget form and card
- [ ] Build one-time goal form and card
- [ ] Implement milestone celebrations
- [ ] Add budget period history view

### Phase 4: Testing & Refinement (Week 5)

- [ ] QA testing (desktop + mobile)
- [ ] Fix bugs
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Analytics integration

### Phase 5: Beta Launch (Week 6)

- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Collect user feedback
- [ ] Iterate on UX

---

## 10. SUCCESS METRICS

### Product Metrics

- **Wallet Creation Rate**: % users who create 2+ wallets
- **Budget Adherence**: % users who stay under budget
- **Goal Completion Rate**: % goals that reach 100%
- **Time to Goal**: Average days from creation to purchase
- **Social Funding**: % public goals that receive contributions

### Engagement Metrics

- **DAU/MAU Ratio**: Daily active users / Monthly active users
- **Session Duration**: Time spent managing wallets
- **Return Rate**: % users who return after 7 days, 30 days
- **Feature Adoption**: % users using recurring vs one-time vs general

### Business Metrics

- **Conversion Rate**: Free → Paid (freemium upgrade)
- **ARPU**: Average revenue per user
- **Churn Rate**: % users who stop using after 30 days
- **NPS Score**: Net promoter score from surveys

### Target Goals (6 months post-launch)

- 50%+ users create at least 1 recurring budget
- 30%+ users create at least 1 savings goal
- 15% conversion rate to paid tier
- $25 ARPU for paid users
- NPS > 40

---

## 11. FUTURE ENHANCEMENTS

### Short Term (3-6 months)

- **Spending Analytics**: Charts showing trends over time
- **Budget Recommendations**: AI suggests optimal budget amounts
- **Receipt Scanning**: OCR to categorize expenses automatically
- **Bill Reminders**: Notifications before rent/bills are due
- **Family Sharing**: Joint wallets with multiple owners

### Medium Term (6-12 months)

- **Lightning Network Integration**: Instant micro-payments
- **DCA (Dollar Cost Averaging)**: Auto-convert fiat to BTC
- **Multi-Currency Support**: EUR, GBP, CHF budgets
- **Merchant Integration**: Pay directly from budget wallet
- **Goal Templates**: Pre-built goals (emergency fund, vacation, etc.)

### Long Term (12+ months)

- **Smart Contracts**: Escrow for large goals
- **DAO Funding**: Community votes on public project goals
- **Savings Challenges**: Gamified group savings competitions
- **Credit Building**: Proof of savings for Bitcoin-backed loans
- **Tax Reporting**: Export for accountants (IRS Form 8949)

---

## CONCLUSION

By distinguishing between **recurring budgets** and **one-time goals**, we create:

1. **Better UX**: Contextual UI that matches user mental models
2. **Higher Engagement**: Milestone celebrations and progress tracking
3. **Revenue Opportunity**: Premium features for power users
4. **Market Differentiation**: First Bitcoin wallet with true budget management

The implementation requires careful coordination across database, backend, and frontend, but the user value and business potential make it a strategic priority.

**Next Steps**: Review this document, approve the approach, and begin Phase 1 (database migration).

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Author**: Claude Code Assistant
**Status**: Ready for Implementation
