# Unified Project Creation Flow: Individual vs Group

**Created:** 2025-12-30  
**Purpose:** Design modular flow for both individual and group project creation

---

## 🎯 Two User Journeys

### Journey 1: Individual Project
```
User creates project
  ↓
No group associated
  ↓
Project created directly (owned by user)
  ↓
No voting needed
```

### Journey 2: Group Project
```
User creates project
  ↓
Associates with group
  ↓
System creates PROPOSAL (not project)
  ↓
Group votes on proposal
  ↓
If passes → Project created (owned by group)
If fails → No project created
```

---

## 🏗️ Modular Design: Single Form, Smart Routing

### Core Principle

**Same project creation form, different behavior based on `group_id`:**

- **If `group_id` is null/undefined** → Create project directly
- **If `group_id` is set** → Create proposal instead (which creates project when passed)

**Why This Works:**
- ✅ Reuses existing `EntityForm` component
- ✅ Reuses existing `projectConfig`
- ✅ Just adds one optional field (`group_id`)
- ✅ API route handles routing logic
- ✅ No new components needed

---

## 📋 Implementation Design

### Step 1: Add Group Selector to Project Form

**File:** `src/config/entity-configs/project-config.ts`

```typescript
const fieldGroups: FieldGroup[] = [
  {
    id: 'ownership',  // NEW GROUP
    title: 'Project Ownership',
    description: 'Create for yourself or propose to a group',
    fields: [
      {
        name: 'group_id',
        label: 'Create for Group (Optional)',
        type: 'select',
        placeholder: 'Select a group...',
        hint: 'If selected, this will create a proposal for the group to vote on. If not selected, project is created directly.',
        options: [], // Populated dynamically from user's groups
        showWhen: {
          // Only show if user is member of at least one group
          // This can be checked in component
        },
        colSpan: 2,
      },
    ],
  },
  // ... existing field groups
];
```

**Alternative: Simpler Approach**

Add field to existing "details" group:

```typescript
{
  id: 'details',
  title: 'Project Details',
  fields: [
    // ... existing fields
    {
      name: 'group_id',
      label: 'Propose to Group (Optional)',
      type: 'select',
      placeholder: 'Create for yourself, or propose to a group...',
      hint: 'If you select a group, members will vote on this proposal before the project is created.',
      options: [], // Dynamic: user's groups
      colSpan: 2,
    },
  ],
}
```

### Step 2: Update Project Schema

**File:** `src/lib/validation.ts` (or wherever projectSchema is)

```typescript
export const projectSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(5000),
  goal_amount: z.number().positive().optional(),
  currency: z.string().default('SATS'),
  // ... existing fields
  group_id: z.string().uuid().optional().nullable(), // NEW: Optional group
});
```

### Step 3: Update Project Service

**File:** `src/domain/projects/service.ts`

```typescript
export async function createProject(
  userId: string, 
  payload: any,
  groupId?: string | null  // NEW: Optional group
) {
  const supabase = await createServerClient();
  
  // Get actor_id if group
  let actorId = null;
  if (groupId) {
    const { data: groupActor } = await supabase
      .from('actors')
      .select('id')
      .eq('group_id', groupId)
      .eq('actor_type', 'group')
      .maybeSingle();
    actorId = groupActor?.id || null;
  }
  
  const insertPayload = {
    user_id: userId,  // Creator (individual)
    group_id: groupId || null,  // Owner (group, if set)
    actor_id: actorId,  // Unified ownership
    title: payload.title,
    description: payload.description,
    // ... rest of fields
  };
  
  const { data, error } = await supabase
    .from('projects')
    .insert(insertPayload)
    .select('*')
    .single();
  
  if (error) {
    throw error;
  }
  return data;
}
```

### Step 4: Smart API Route Logic

**File:** `src/app/api/projects/route.ts`

```typescript
export const POST = compose(
  withRequestId(),
  withZodBody(projectSchema)
)(async (request: NextRequest, ctx) => {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiUnauthorized();
    }

    // ROUTING LOGIC: Check if group_id is set
    if (ctx.body.group_id) {
      // GROUP PROJECT: Create proposal instead
      return await createProjectProposal(user.id, ctx.body);
    } else {
      // INDIVIDUAL PROJECT: Create directly
      const project = await createProject(user.id, ctx.body);
      logger.info('Project created successfully', { userId: user.id, projectId: project.id });
      return apiSuccess(project, { status: 201 });
    }
  } catch (error) {
    return handleApiError(error);
  }
});

// NEW: Helper function to create proposal for group project
async function createProjectProposal(userId: string, projectData: any) {
  // 1. Check if user is member of group
  const isMember = await isGroupMember(projectData.group_id, userId);
  if (!isMember) {
    return apiError('You must be a member of the group to propose projects', 403);
  }
  
  // 2. Check permission to create proposals
  const permission = await checkGroupPermission(
    projectData.group_id,
    userId,
    'create_proposal'
  );
  if (!permission.allowed) {
    return apiError('Not allowed to create proposals in this group', 403);
  }
  
  // 3. Create proposal with action_type = "create_project"
  const proposal = await createProposal({
    group_id: projectData.group_id,
    proposer_id: userId,
    title: `Project Proposal: ${projectData.title}`,
    description: projectData.description,
    proposal_type: 'general', // Or 'treasury' if using group funds
    action_type: 'create_project',
    action_data: {
      title: projectData.title,
      description: projectData.description,
      goal_amount: projectData.goal_amount,
      currency: projectData.currency,
      funding_purpose: projectData.funding_purpose,
      bitcoin_address: projectData.bitcoin_address,
      lightning_address: projectData.lightning_address,
      website_url: projectData.website_url,
      category: projectData.category,
      tags: projectData.tags,
      // ... all project fields
    },
    status: 'draft',
  });
  
  // 4. Return proposal (not project)
  return apiSuccess({
    proposal,
    message: 'Project proposal created. It will be created after group approval.',
  }, { status: 201 });
}
```

---

## 🎨 UI Component: Group Selector

### Option A: Simple Select Dropdown

**Reuse existing `FormField` component with `type: 'select'`**

The `EntityForm` already supports select fields. Just need to populate options dynamically.

**File:** `src/components/create/EntityForm.tsx` (or create wrapper)

```typescript
// In EntityForm, when rendering group_id field:
const { data: userGroups } = await groupsService.getUserGroups();

// Populate options
const groupOptions = userGroups.map(group => ({
  value: group.id,
  label: `${group.name} (${group.label})`,
}));

// Pass to FormField
<FormField
  config={{
    ...field,
    options: groupOptions,
  }}
  // ...
/>
```

### Option B: Enhanced Select with Info

**Show group info when selected:**

```typescript
{
  name: 'group_id',
  label: 'Propose to Group',
  type: 'select',
  options: userGroups.map(g => ({
    value: g.id,
    label: g.name,
    description: `${g.label} • ${g.member_count} members`, // Show in dropdown
  })),
  hint: 'If selected, this project will require group approval before being created.',
}
```

---

## 🔄 Complete Flow Diagrams

### Flow 1: Individual Project (No Group)

```
User fills project form
  ├─ group_id: null (not selected)
  └─ ... other project fields
  ↓
POST /api/projects
  ↓
API checks: group_id is null
  ↓
createProject(userId, payload)
  ↓
Project created directly
  ├─ user_id: userId (owner)
  ├─ group_id: null
  └─ actor_id: user's actor_id
  ↓
Return project
  ↓
Redirect to /projects/[id]
```

### Flow 2: Group Project (With Group)

```
User fills project form
  ├─ group_id: "building-group-id" (selected)
  └─ ... other project fields
  ↓
POST /api/projects
  ↓
API checks: group_id is set
  ↓
createProjectProposal(userId, payload)
  ├─ Check membership ✓
  ├─ Check permission ✓
  └─ Create proposal
      ├─ action_type: "create_project"
      └─ action_data: { ...project fields }
  ↓
Return proposal
  ↓
Redirect to /groups/[slug]/proposals/[id]
  ↓
Group votes on proposal
  ↓
If passes → executeCreateProject()
  ├─ Get group's actor_id
  ├─ Create project
  │   ├─ user_id: proposer (individual)
  │   ├─ group_id: group (owner)
  │   └─ actor_id: group's actor_id
  └─ Link proposal to project
```

---

## 🎯 Key Design Decisions

### 1. Single Form, Smart Routing

**Decision:** Same form handles both cases, API routes based on `group_id`.

**Why:**
- ✅ Maximum code reuse
- ✅ Same UX (just one extra field)
- ✅ No duplicate forms
- ✅ Easy to understand

### 2. Proposal Created Automatically

**Decision:** If `group_id` is set, automatically create proposal (not project).

**Why:**
- ✅ User doesn't need to understand proposals
- ✅ Seamless experience
- ✅ System handles complexity

### 3. Project Ownership Model

**Decision:** When project created from proposal:
- `user_id` = Proposer (individual who had the idea)
- `group_id` = Group (owner)
- `actor_id` = Group's actor (unified ownership)

**Why:**
- ✅ Tracks who proposed it
- ✅ Group owns and manages it
- ✅ Supports both individual and group projects

---

## 📝 Implementation Steps

### Phase 1: Add Group Support to Project Form (2-3 hours)

1. **Update Project Config**
   - Add `group_id` field to `projectConfig`
   - Add to validation schema

2. **Update EntityForm**
   - Load user's groups
   - Populate group selector options
   - Show/hide based on membership

3. **Update Project Service**
   - Add `group_id` and `actor_id` support
   - Handle group ownership

### Phase 2: Smart API Routing (1-2 hours)

1. **Update API Route**
   - Check for `group_id`
   - Route to proposal creation if set
   - Route to direct creation if not

2. **Create Proposal Helper**
   - `createProjectProposal()` function
   - Permission checks
   - Proposal creation

### Phase 3: Proposal Execution (2-3 hours)

1. **Execution Handler**
   - `executeCreateProject()` function
   - Create project with group ownership
   - Link proposal to project

2. **Integration**
   - Add to proposals system
   - Auto-execute when proposal passes

**Total:** ~5-8 hours (much less than full proposals system)

---

## 🔍 What Gets Reused

### ✅ Existing Components
- `EntityForm` - No changes needed (supports select fields)
- `projectConfig` - Just add one field
- `CreateEntityWorkflow` - No changes needed
- Project templates - No changes needed

### ✅ Existing Services
- `groupsService.getUserGroups()` - Get user's groups for selector
- `isGroupMember()` - Check membership
- `checkGroupPermission()` - Check proposal permission

### ✅ Existing Patterns
- Service layer pattern (Auth → Permissions → Validate → Operate → Log → Return)
- API route pattern
- Form validation pattern

### ❌ What Needs to Be Built
- Proposal creation (when `group_id` is set)
- Proposal execution (when proposal passes)
- Group selector field (populate options)

**But:** This is much less than building full proposals system upfront!

---

## 💡 Alternative: Progressive Enhancement

### Phase 1: Basic Group Support (No Voting Yet)

**If proposals aren't ready yet:**

1. Add `group_id` to project form
2. If `group_id` set, create project with `status: 'pending_approval'`
3. Show in group's "Pending Projects" section
4. Group can approve/reject manually

**Later:** Replace manual approval with proposals/voting

**Pros:**
- Faster to implement
- Gets group projects working
- Can upgrade to proposals later

**Cons:**
- Not as elegant
- Manual approval step

---

## 🎯 Recommended Approach

### Option A: Full Proposals Integration (Recommended)

**Implement proposals system first, then add group selector to project form.**

**Why:**
- ✅ Most elegant solution
- ✅ Follows your described flow exactly
- ✅ Reusable for other actions (spending, settings, etc.)
- ✅ Matches design document

**Timeline:**
- Proposals system: 12-16 hours
- Add group selector: 2-3 hours
- **Total: 14-19 hours**

### Option B: Progressive (Faster)

**Add group selector now, use manual approval, upgrade later.**

**Why:**
- ✅ Faster to ship
- ✅ Gets group projects working
- ⚠️ Less elegant (manual approval)

**Timeline:**
- Add group selector: 2-3 hours
- Manual approval: 1-2 hours
- **Total: 3-5 hours** (then upgrade later)

---

## 📊 Comparison

| Approach | Time | Elegance | Reusability | Matches Vision |
|----------|------|----------|-------------|----------------|
| **Full Proposals** | 14-19h | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ Perfect |
| **Progressive** | 3-5h | ⭐⭐⭐ | ⭐⭐ | ⚠️ Partial |

---

## ✅ Summary

**Your flow is architecturally sound and can be implemented modularly:**

1. **Add one field** (`group_id`) to existing project form
2. **API routes smartly** based on whether `group_id` is set
3. **Reuses existing** components, patterns, services
4. **Minimal new code** needed

**The key insight:** Same form, different backend behavior. Maximum modularity, minimum new code.

---

**Last Updated:** 2025-12-30

