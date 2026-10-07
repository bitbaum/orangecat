# Network State Development Guide

**Use Case: Ossetia**
**Created:** 2025-12-30
**Last Modified:** 2025-01-30
**Last Modified Summary:** Major implementation progress - proposals, voting, treasury, job postings completed

---

## Executive Summary

The groups system has been significantly enhanced. Core functionality is now **80-90% complete** with full UI implementation. This guide uses "Ossetia" as a concrete use case to design and implement the missing pieces.

### Current State

| Feature | Status | What Works | What's Broken |
|---------|--------|------------|---------------|
| **Members** | 100% | Join/leave, invitations | ✅ Complete |
| **Treasury** | 90% | Schema, balance fetching, CRUD | Minor: contribution tracking |
| **Proposals** | 95% | Full service, API, UI | ✅ Complete |
| **Voting** | 95% | Vote recording, UI, enforcement | ✅ Complete |
| **Events** | 100% | Full service, API, UI | ✅ Complete |
| **Permissions** | 90% | Config/checking, enforcement middleware | ✅ Complete |
| **Job Postings** | 90% | Public proposals, browse page | Minor: application flow |
| **Contracts** | 85% | Service, execution handler | Minor: UI components |

---

## Part 1: The Ossetia Use Case

### What Ossetia Needs

```
OSSETIA NETWORK STATE
├── Identity
│   ├── Name, description, branding
│   ├── Public profile page (/groups/ossetia)
│   └── Discoverability in /groups
│
├── Membership (PRIORITY 1)
│   ├── Founder can invite initial members
│   ├── Members can invite others (with permission)
│   ├── Pending invitations with expiry
│   ├── Application process for public groups
│   └── Member directory with roles
│
├── Treasury (PRIORITY 2)
│   ├── Shared Bitcoin wallet (view balance)
│   ├── Contribution tracking (who gave what)
│   ├── Spending proposals (require vote)
│   └── Lightning address for donations
│
├── Governance (PRIORITY 1)
│   ├── Democratic voting (51% majority)
│   ├── Proposals for decisions
│   ├── Role-based permissions that WORK
│   └── Transparent decision history
│
├── Events (PRIORITY 3)
│   ├── Schedule community gatherings
│   ├── Online/offline events
│   └── RSVP tracking
│
└── Communication (FUTURE)
    ├── Group chat/forum
    └── Announcements
```

### User Stories

**US-1: Founding Ossetia**
```
As the founder, I want to:
1. Create "Ossetia" network state ✓ (works)
2. Set democratic governance ✓ (works)
3. Add a treasury Bitcoin address ✗ (broken)
4. Invite my 5 co-founders ✗ (no invite system)
```

**US-2: Joining Ossetia**
```
As a potential member, I want to:
1. Discover Ossetia in /groups ✓ (works)
2. View public info about Ossetia ✓ (works)
3. Request to join OR accept an invite ✗ (no workflow)
4. See my membership status ✗ (no pending state)
```

**US-3: Collective Decision Making**
```
As a member, I want to:
1. Create a proposal "Fund cultural center" ✗ (disconnected)
2. Have other members vote on it ✗ (disconnected)
3. See the proposal pass at 51% ✗ (not enforced)
4. Have the treasury release funds ✗ (no integration)
```

---

## Part 2: Architecture Fixes

### Fix 1: Wallet Table Mismatch (CRITICAL)

**Problem:** Code references `organization_wallets`, database has `group_wallets`

**Files to fix:**
- `src/services/groups/mutations/wallets.ts` - Line 31, 70, 95
- `src/services/groups/queries/wallets.ts` - Line 28

**Solution:**
```typescript
// In constants.ts - ALREADY CORRECT
export const TABLES = {
  groups: 'groups',
  members: 'group_members',
  wallets: 'group_wallets',  // ← Correct
  // ...
};

// In mutations/wallets.ts - NEEDS FIX
// Change: .from('organization_wallets')
// To:     .from(TABLES.wallets)
```

### Fix 2: Unify Proposals/Voting Under Groups

**Problem:** Proposals API is at `/api/organizations/[id]/proposals/`, should be `/api/groups/[slug]/proposals/`

**Solution:**
1. Create new routes:
   - `src/app/api/groups/[slug]/proposals/route.ts`
   - `src/app/api/groups/[slug]/proposals/[proposalId]/vote/route.ts`

2. Add service layer functions:
   ```typescript
   // In src/services/groups/index.ts
   export {
     createProposal,
     getProposals,
     getProposal,
     updateProposal,
     castVote,
     getVotes,
   } from './mutations/proposals';
   ```

3. Create the mutations file:
   - `src/services/groups/mutations/proposals.ts`

### Fix 3: Permission Enforcement

**Problem:** Permissions are checked but not enforced

**Solution:** Create permission middleware:

```typescript
// src/services/groups/permissions/enforce.ts
export async function enforcePermission(
  userId: string,
  groupId: string,
  action: ActionPermission
): Promise<{ allowed: boolean; requiresVote: boolean; error?: string }> {
  const { allowed, requiresVote } = await canPerformAction(userId, groupId, action);

  if (!allowed && !requiresVote) {
    return { allowed: false, requiresVote: false, error: 'Permission denied' };
  }

  if (requiresVote) {
    // Don't allow direct action - must create proposal
    return { allowed: false, requiresVote: true, error: 'This action requires a vote' };
  }

  return { allowed: true, requiresVote: false };
}
```

---

## Part 3: Feature Implementation Plans

### Feature 1: Member Invitation System

> **Superseded (2026-10-07).** The plan below was never built as written. What
> exists: `docs/development/GROUP_FEATURES_IMPLEMENTATION_STATUS.md` → Invitations.

**Database Schema (already exists, needs new table):**
```sql
CREATE TABLE group_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id),
  invitee_email text,           -- For email invites
  invitee_user_id uuid,         -- For in-app invites
  token text UNIQUE NOT NULL,   -- Secure invitation token
  role text DEFAULT 'member',   -- Role to assign on accept
  status text DEFAULT 'pending', -- pending, accepted, declined, expired
  message text,                 -- Personal invitation message
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz
);

CREATE INDEX idx_group_invitations_token ON group_invitations(token);
CREATE INDEX idx_group_invitations_group ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_email ON group_invitations(invitee_email);
```

**Service Functions:**
```typescript
// src/services/groups/mutations/invitations.ts

export async function createInvitation(
  groupId: string,
  inviteeEmail: string,
  role: GroupRole = 'member',
  message?: string
): Promise<InvitationResponse>

export async function acceptInvitation(
  token: string
): Promise<MemberResponse>

export async function declineInvitation(
  token: string
): Promise<{ success: boolean }>

export async function revokeInvitation(
  invitationId: string
): Promise<{ success: boolean }>

export async function getGroupInvitations(
  groupId: string
): Promise<InvitationsListResponse>

export async function getMyInvitations(): Promise<InvitationsListResponse>
```

**API Routes:**
```
POST   /api/groups/[slug]/invitations      - Create invitation
GET    /api/groups/[slug]/invitations      - List pending invitations
DELETE /api/groups/[slug]/invitations/[id] - Revoke invitation

POST   /api/invitations/[token]/accept     - Accept invitation
POST   /api/invitations/[token]/decline    - Decline invitation
GET    /api/invitations/mine               - My pending invitations
```

**UI Components:**
```
src/components/groups/
├── InviteMemberDialog.tsx     - Form to invite by email/username
├── InvitationsList.tsx        - Admin view of pending invites
├── MyInvitations.tsx          - User's pending invites
└── InvitationCard.tsx         - Single invitation display
```

**UX Flow for Ossetia:**
```
1. Founder clicks "Invite Members" on /groups/ossetia
2. Dialog opens with:
   - Email input (or username search)
   - Role selector (member/admin)
   - Optional message: "Join us in building Ossetia!"
3. System generates secure token, sends email
4. Invitee receives email with link: /invite/[token]
5. Invitee clicks link, sees Ossetia info, clicks "Accept"
6. Invitee added as member with specified role
```

---

### Feature 2: Working Treasury

**Phase 1: Display Only (MVP)**
```typescript
// Just show addresses and track contributions manually
interface GroupTreasury {
  bitcoin_address: string;
  lightning_address: string;
  balance_sats: number;        // Manual update or API fetch
  last_balance_update: string;
}
```

**Phase 2: Balance Fetching**
```typescript
// Fetch balance from blockchain API
async function updateTreasuryBalance(groupId: string) {
  const { bitcoin_address } = await getGroupTreasury(groupId);

  // Use mempool.space API
  const response = await fetch(
    `https://mempool.space/api/address/${bitcoin_address}`
  );
  const data = await response.json();

  await updateBalance(groupId, data.chain_stats.funded_txo_sum);
}
```

**Phase 3: Contribution Tracking**
```sql
CREATE TABLE group_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id),
  user_id uuid REFERENCES auth.users(id),  -- null for anonymous
  amount_sats bigint NOT NULL,
  txid text,                    -- Bitcoin transaction ID
  source text,                  -- 'onchain', 'lightning', 'manual'
  note text,
  verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Phase 4: Spending Proposals (Requires Voting)**
```
1. Member creates "Spending Proposal":
   - Amount: 1,000,000 sats
   - Recipient: bc1q...
   - Purpose: "Fund Ossetia cultural center"

2. Proposal goes to vote (democratic = 51% threshold)

3. If passed:
   - Proposal marked "approved"
   - Authorized signers notified
   - Manual execution (multisig)

4. After execution:
   - Admin marks as "executed" with txid
   - Contribution record created (negative amount)
```

---

### Feature 3: Proposals & Voting

**Service Layer:**
```typescript
// src/services/groups/mutations/proposals.ts

interface CreateProposalInput {
  group_id: string;
  title: string;
  description: string;
  proposal_type: 'general' | 'spending' | 'membership' | 'governance';
  // For spending proposals:
  amount_sats?: number;
  recipient_address?: string;
  // Voting config:
  voting_starts_at?: string;  // Default: now
  voting_ends_at?: string;    // Default: +7 days
}

export async function createProposal(
  input: CreateProposalInput
): Promise<ProposalResponse> {
  // 1. Check permission (create_proposal)
  const perm = await enforcePermission(userId, input.group_id, 'create_proposal');
  if (!perm.allowed) throw new Error(perm.error);

  // 2. Get group's voting threshold
  const group = await getGroup(input.group_id);
  const preset = GOVERNANCE_PRESETS[group.governance_preset];

  // 3. Create proposal with threshold
  const proposal = await supabase
    .from('group_proposals')
    .insert({
      ...input,
      proposer_id: userId,
      status: 'active',
      passing_threshold: preset.votingThreshold,
      voting_starts_at: input.voting_starts_at || new Date().toISOString(),
      voting_ends_at: input.voting_ends_at || addDays(new Date(), 7).toISOString(),
    })
    .select()
    .single();

  return { success: true, proposal };
}

export async function castVote(
  proposalId: string,
  vote: 'yes' | 'no' | 'abstain'
): Promise<VoteResponse> {
  // 1. Check permission
  const proposal = await getProposal(proposalId);
  const perm = await enforcePermission(userId, proposal.group_id, 'vote');
  if (!perm.allowed) throw new Error(perm.error);

  // 2. Check voting is open
  if (new Date() < new Date(proposal.voting_starts_at)) {
    throw new Error('Voting has not started');
  }
  if (new Date() > new Date(proposal.voting_ends_at)) {
    throw new Error('Voting has ended');
  }

  // 3. Get member's voting power (default 1.0)
  const member = await getGroupMember(proposal.group_id, userId);
  const votingPower = member.voting_power || 1.0;

  // 4. Upsert vote
  const { data: voteRecord } = await supabase
    .from('group_votes')
    .upsert({
      proposal_id: proposalId,
      voter_id: userId,
      vote,
      voting_power: votingPower,
    })
    .select()
    .single();

  // 5. Check if proposal should resolve
  await checkAndResolveProposal(proposalId);

  return { success: true, vote: voteRecord };
}

async function checkAndResolveProposal(proposalId: string) {
  const proposal = await getProposal(proposalId);
  const votes = await getVotes(proposalId);
  const members = await getGroupMembers(proposal.group_id);

  const totalVotingPower = members.reduce((sum, m) => sum + (m.voting_power || 1), 0);
  const yesVotes = votes.filter(v => v.vote === 'yes').reduce((sum, v) => sum + v.voting_power, 0);
  const noVotes = votes.filter(v => v.vote === 'no').reduce((sum, v) => sum + v.voting_power, 0);

  const participation = (yesVotes + noVotes) / totalVotingPower;
  const yesPercentage = yesVotes / (yesVotes + noVotes);

  // Check if voting period ended OR quorum reached
  const votingEnded = new Date() > new Date(proposal.voting_ends_at);
  const quorumReached = participation >= 0.5; // 50% participation

  if (votingEnded || quorumReached) {
    const passed = yesPercentage >= (proposal.passing_threshold / 100);

    await supabase
      .from('group_proposals')
      .update({
        status: passed ? 'passed' : 'failed',
        resolved_at: new Date().toISOString(),
        final_yes_votes: yesVotes,
        final_no_votes: noVotes,
        final_participation: participation,
      })
      .eq('id', proposalId);
  }
}
```

**UI Components:**
```
src/components/groups/proposals/
├── CreateProposalDialog.tsx   - Form to create proposal
├── ProposalsList.tsx          - List of group proposals
├── ProposalCard.tsx           - Single proposal summary
├── ProposalDetail.tsx         - Full proposal with voting
├── VotingProgress.tsx         - Visual vote tally
└── VoteButtons.tsx            - Yes/No/Abstain buttons
```

**UX Flow for Ossetia:**
```
1. Member clicks "New Proposal" on /groups/ossetia
2. Selects type: "Spending Proposal"
3. Fills form:
   - Title: "Fund Ossetia Cultural Center"
   - Description: "Allocate 5M sats for..."
   - Amount: 5,000,000 sats
   - Recipient: bc1q...
   - Voting period: 7 days
4. Submits - proposal goes live
5. Members receive notification
6. Members vote over 7 days
7. At end:
   - 67% yes, 33% no
   - Passes (>51% threshold)
   - Marked "approved" - awaiting execution
8. Treasury signers execute multisig transaction
9. Admin marks "executed" with txid
```

---

### Feature 4: Events Integration

**Database Schema:**
```sql
CREATE TABLE group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  event_type text DEFAULT 'general', -- general, meeting, celebration, assembly
  location_type text DEFAULT 'online', -- online, in_person, hybrid
  location_details text,              -- Address or video link
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  timezone text DEFAULT 'UTC',
  max_attendees integer,
  is_public boolean DEFAULT true,     -- Non-members can see
  requires_rsvp boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE group_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  status text DEFAULT 'going', -- going, maybe, not_going
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);
```

**Service Layer:**
```typescript
// src/services/groups/mutations/events.ts

export async function createEvent(input: CreateEventInput): Promise<EventResponse>
export async function updateEvent(eventId: string, input: UpdateEventInput): Promise<EventResponse>
export async function deleteEvent(eventId: string): Promise<{ success: boolean }>
export async function rsvpToEvent(eventId: string, status: RsvpStatus): Promise<RsvpResponse>

// src/services/groups/queries/events.ts
export async function getGroupEvents(groupId: string, options?: EventsQuery): Promise<EventsListResponse>
export async function getEvent(eventId: string): Promise<EventResponse>
export async function getEventRsvps(eventId: string): Promise<RsvpsListResponse>
export async function getUpcomingEvents(groupId: string): Promise<EventsListResponse>
```

---

## Part 4: Implementation Roadmap

### Phase 1: Foundation Fixes (Week 1) ✅ COMPLETE
```
✅ Fix wallet table references (organization_wallets → group_wallets)
✅ Move proposals/voting API from /organizations to /groups
✅ Add proposal/voting service functions to groups service
✅ Ensure permissions are checked in all mutations
✅ Create permission enforcement middleware
```

### Phase 2: Member Invitations (Week 2)
```
□ Create group_invitations table migration
□ Implement invitation service functions
□ Create API routes for invitations
□ Build InviteMemberDialog component
□ Build MyInvitations component
□ Add invitation acceptance flow
```

### Phase 3: Working Proposals & Voting (Week 3) ✅ COMPLETE
```
✅ Complete proposals service layer
✅ Complete voting service layer
✅ Build ProposalsList component
✅ Build CreateProposalDialog component
✅ Build VotingProgress component
✅ Build ProposalCard component
✅ Build ProposalDetail component
✅ Build VoteButtons component
✅ Implement automatic proposal resolution
✅ Add proposal action handlers (create_project, spend_funds, create_contract)
✅ Add proposal detail page route
```

### Phase 4: Treasury Display (Week 4) ✅ MOSTLY COMPLETE
```
✅ Fix wallet CRUD operations
✅ Add balance fetching from mempool.space
✅ Add refresh balance API and UI
✅ Connect spending proposals to treasury
□ Add contribution tracking table (future enhancement)
```

### Phase 5: Events (Week 5)
```
□ Create group_events migration
□ Implement events service layer
□ Build event creation UI
□ Build events list/calendar view
□ Implement RSVP system
```

### Phase 6: Permission Enforcement (Week 6) ✅ COMPLETE
```
✅ Create enforcePermission middleware
✅ Add requirePermission helper
✅ Export from permissions index
✅ Implement "requires vote" flow in resolver
```

---

## Part 5: Testing Checklist (Ossetia)

### Create Ossetia
- [ ] Create network state with name "Ossetia"
- [ ] Verify governance defaults to democratic
- [ ] Verify features auto-enabled

### Invite Members
- [ ] Founder invites co-founder by email
- [ ] Co-founder receives email
- [ ] Co-founder accepts invitation
- [ ] Co-founder appears in members list with correct role

### Create Proposal
- [ ] Member creates spending proposal
- [ ] Proposal appears in proposals list
- [ ] Voting period is correct (7 days)

### Vote on Proposal
- [ ] Member casts "yes" vote
- [ ] Vote count updates
- [ ] Cannot vote twice
- [ ] Voting closes after period ends
- [ ] Proposal resolves correctly (passed/failed)

### Treasury
- [ ] Add Bitcoin address to group
- [ ] Balance displays correctly
- [ ] Contribution history visible

### Events
- [ ] Create "Founding Assembly" event
- [ ] Event appears in group page
- [ ] Members can RSVP
- [ ] RSVP count displays

---

## Part 6: Code Quality Standards

### Service Layer Pattern
```typescript
// Every service function should:
// 1. Get authenticated user
// 2. Check permissions
// 3. Validate input
// 4. Perform operation
// 5. Log activity
// 6. Return typed response

export async function doSomething(input: Input): Promise<Response> {
  try {
    // 1. Auth
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, error: 'Unauthorized' };

    // 2. Permissions
    const perm = await enforcePermission(userId, input.groupId, 'action_name');
    if (!perm.allowed) {
      if (perm.requiresVote) {
        return { success: false, error: 'This action requires a proposal and vote' };
      }
      return { success: false, error: 'Permission denied' };
    }

    // 3. Validate
    const validated = schema.parse(input);

    // 4. Operate
    const { data, error } = await supabase
      .from('table')
      .insert(validated)
      .select()
      .single();

    if (error) {
      logger.error('Failed to do something', error, 'Groups');
      return { success: false, error: error.message };
    }

    // 5. Log activity
    await logActivity(input.groupId, userId, 'did_something', { ...data });

    // 6. Return
    return { success: true, data };
  } catch (error) {
    logger.error('Exception in doSomething', error, 'Groups');
    return { success: false, error: 'Operation failed' };
  }
}
```

### Component Pattern
```typescript
// Every group component should:
// 1. Handle loading state
// 2. Handle error state
// 3. Handle empty state
// 4. Check permissions for actions
// 5. Show appropriate feedback

export function GroupFeature({ groupId }: Props) {
  const { data, isLoading, error } = useGroupData(groupId);
  const { canPerform } = useGroupPermissions(groupId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!data || data.length === 0) return <EmptyState />;

  return (
    <div>
      {data.map(item => <Item key={item.id} {...item} />)}
      {canPerform('create_item') && <CreateButton />}
    </div>
  );
}
```

---

## Appendix: File Locations

### Services
```
src/services/groups/
├── index.ts                    # Main export
├── constants.ts                # Table names, defaults
├── types.ts                    # Type definitions
├── mutations/
│   ├── groups.ts               # CRUD for groups
│   ├── members.ts              # Member management
│   ├── invitations.ts          # NEW: Invitation system
│   ├── wallets.ts              # FIX: Use correct table
│   ├── proposals.ts            # NEW: Proposal management
│   └── events.ts               # NEW: Event management
├── queries/
│   ├── groups.ts               # Group queries
│   ├── members.ts              # Member queries
│   ├── wallets.ts              # FIX: Use correct table
│   ├── activities.ts           # Activity log
│   ├── proposals.ts            # NEW: Proposal queries
│   └── events.ts               # NEW: Event queries
├── permissions/
│   ├── index.ts                # Permission checking
│   ├── defaults.ts             # Default permissions
│   ├── resolver.ts             # Permission resolution
│   └── enforce.ts              # NEW: Permission enforcement
├── utils/
│   ├── helpers.ts              # Helper functions
│   └── activity.ts             # Activity logging
└── validation/
    └── index.ts                # Zod schemas
```

### Components
```
src/components/groups/
├── GroupsDashboard.tsx         # Main dashboard
├── GroupCard.tsx               # Grid card
├── GroupList.tsx               # Grid layout
├── GroupDetail.tsx             # Detail page
├── GroupMembers.tsx            # Members tab
├── GroupWallets.tsx            # Treasury tab
├── CreateGroupDialog.tsx       # Creation form
├── invitations/                # NEW
│   ├── InviteMemberDialog.tsx
│   ├── InvitationsList.tsx
│   └── InvitationCard.tsx
├── proposals/                  # NEW
│   ├── CreateProposalDialog.tsx
│   ├── ProposalsList.tsx
│   ├── ProposalCard.tsx
│   ├── ProposalDetail.tsx
│   └── VotingProgress.tsx
└── events/                     # NEW
    ├── CreateEventDialog.tsx
    ├── EventsList.tsx
    ├── EventCard.tsx
    └── RsvpButton.tsx
```

### API Routes
```
src/app/api/groups/
├── route.ts                    # GET/POST groups
├── [slug]/
│   ├── route.ts                # GET/PUT/DELETE group
│   ├── members/
│   │   └── route.ts            # GET/POST members
│   ├── invitations/            # NEW
│   │   ├── route.ts            # GET/POST invitations
│   │   └── [id]/
│   │       └── route.ts        # DELETE invitation
│   ├── proposals/              # NEW (moved from /organizations)
│   │   ├── route.ts            # GET/POST proposals
│   │   └── [proposalId]/
│   │       ├── route.ts        # GET/PUT proposal
│   │       └── vote/
│   │           └── route.ts    # POST vote
│   ├── wallets/
│   │   └── route.ts            # GET/POST wallets
│   └── events/                 # NEW
│       ├── route.ts            # GET/POST events
│       └── [eventId]/
│           ├── route.ts        # GET/PUT/DELETE event
│           └── rsvp/
│               └── route.ts    # POST rsvp

src/app/api/invitations/        # NEW
├── mine/
│   └── route.ts                # GET my invitations
└── [token]/
    ├── accept/
    │   └── route.ts            # POST accept
    └── decline/
        └── route.ts            # POST decline
```

---

**This guide provides the roadmap to build Ossetia and any network state properly. Start with Phase 1 fixes, then systematically build each feature.**
