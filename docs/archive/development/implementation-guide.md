# OrangeCat Implementation Guide

**Created:** 2025-10-13
**Status:** Ready for Implementation
**Prerequisites:** ARCHITECTURE.md (read first)

---

## 📋 Overview

This guide provides step-by-step instructions for implementing the architecture defined in ARCHITECTURE.md. All SQL migrations and TypeScript types are ready.

## ✅ Completed Steps

1. ✅ Architecture document created (ARCHITECTURE.md)
2. ✅ SQL migrations created for new tables
3. ✅ TypeScript types updated in database.ts
4. ✅ Profile editing functionality working

## 🗂️ Files Created

### SQL Migrations (in `/supabase/migrations/`)

1. **`20251013_create_organization_members.sql`**
   - Creates `organization_members` table with roles and permissions
   - Includes Row Level Security (RLS) policies
   - Auto-generates `updated_at` timestamps
   - Indexes for performance

2. **`20251013_create_projects.sql`**
   - Creates `projects` table for long-term initiatives
   - Polymorphic ownership (profile or organization)
   - Auto-generates slugs from project names
   - Full-text search support
   - Complete RLS policies

3. **`20251013_add_project_to_projects.sql`**
   - Adds `project_id` foreign key to projects table
   - Links projects to parent projects

### TypeScript Updates

**`/src/types/database.ts`** - Added:

- `organization_members` table types (Row, Insert, Update)
- `projects` table types (Row, Insert, Update)
- `project_id` field to projects
- Helper types: `OrganizationMember`, `Project`
- Form data types: `OrganizationFormData`, `ProjectFormData`
- Permission types: `OrganizationPermissions`
- Extended types with relationships: `OrganizationWithMembers`, `ProjectWithProjects`, etc.

---

## 🚀 Implementation Steps

### Phase 1: Database Setup (Priority: HIGH)

#### Step 1.1: Apply Migrations

```bash
# Apply each SQL migration via psql against the self-hosted DB on the box.
# (DB is self-hosted Supabase at supabase.orangecat.ch — managed cloud retired 2026-06.)
# See docs/supabase/migrations-guide.md for the canonical workflow.
# Run each migration file in order:
psql "$POSTGRES_URL" -f supabase/migrations/20251013_create_organization_members.sql
psql "$POSTGRES_URL" -f supabase/migrations/20251013_create_projects.sql
psql "$POSTGRES_URL" -f supabase/migrations/20251013_add_project_to_projects.sql
```

#### Step 1.2: Verify Tables Created

```sql
-- Check organization_members table
SELECT * FROM organization_members LIMIT 1;

-- Check projects table
SELECT * FROM projects LIMIT 1;

-- Check projects has project_id
SELECT id, title, project_id FROM projects LIMIT 1;
```

---

### Phase 2: Service Layer (Priority: HIGH)

Create service files for the new entities following the existing pattern.

#### Step 2.1: Create Organization Members Service

**File:** `/src/services/supabase/organization-members.ts`

```typescript
import { createServerClient } from './server';
import type {
  OrganizationMember,
  OrganizationMemberInsert,
  OrganizationMemberUpdate,
  OrganizationPermissions,
} from '@/types/database';

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('*, profiles(*)')
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a member to an organization
 */
export async function addOrganizationMember(
  organizationId: string,
  profileId: string,
  role: 'owner' | 'admin' | 'member' | 'contributor',
  invitedBy: string,
  permissions?: OrganizationPermissions
): Promise<OrganizationMember> {
  const supabase = await createServerClient();

  const memberData: OrganizationMemberInsert = {
    organization_id: organizationId,
    profile_id: profileId,
    role,
    invited_by: invitedBy,
    permissions: permissions || {},
    status: 'pending', // Requires acceptance
  };

  const { data, error } = await supabase
    .from('organization_members')
    .insert(memberData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update member role or permissions
 */
export async function updateOrganizationMember(
  memberId: string,
  updates: OrganizationMemberUpdate
): Promise<OrganizationMember> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .update(updates)
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a member from an organization
 */
export async function removeOrganizationMember(memberId: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase.from('organization_members').delete().eq('id', memberId);

  if (error) throw error;
}

/**
 * Check if user can edit organization
 */
export async function canEditOrganization(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('organization_members')
    .select('role, permissions')
    .eq('organization_id', organizationId)
    .eq('profile_id', userId)
    .eq('status', 'active')
    .single();

  if (error || !data) return false;

  // Owners and admins can always edit
  if (data.role === 'owner' || data.role === 'admin') {
    return true;
  }

  // Check specific permission
  return (data.permissions as OrganizationPermissions)?.can_edit_org === true;
}
```

#### Step 2.2: Create Projects Service

**File:** `/src/services/supabase/projects.ts`

```typescript
import { createServerClient } from './server';
import type { Project, ProjectInsert, ProjectUpdate, ProjectWithProjects } from '@/types/database';

/**
 * Get all public projects
 */
export async function getPublicProjects(limit = 50, offset = 0): Promise<Project[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('visibility', 'public')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

/**
 * Get project by slug
 */
export async function getProjectBySlug(slug: string): Promise<ProjectWithProjects | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*, projects(*)')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }

  return data;
}

/**
 * Create a new project
 */
export async function createProject(projectData: ProjectInsert): Promise<Project> {
  const supabase = await createServerClient();

  const { data, error } = await supabase.from('projects').insert(projectData).select().single();

  if (error) throw error;
  return data;
}

/**
 * Update a project
 */
export async function updateProject(projectId: string, updates: ProjectUpdate): Promise<Project> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = await createServerClient();

  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) throw error;
}

/**
 * Get projects owned by a profile or organization
 */
export async function getProjectsByOwner(
  ownerType: 'profile' | 'organization',
  ownerId: string
): Promise<Project[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_type', ownerType)
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
```

---

### Phase 3: API Routes (Priority: HIGH)

Create API endpoints following the existing pattern in `/src/app/api/`.

#### Step 3.1: Organization Members API

**File:** `/src/app/api/organizations/[id]/members/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createServerClient } from '@/services/supabase/server';
import {
  getOrganizationMembers,
  addOrganizationMember,
  canEditOrganization,
} from '@/services/supabase/organization-members';
import { handleApiError, AuthError } from '@/lib/errors';

// GET /api/organizations/[id]/members - List organization members
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const members = await getOrganizationMembers(params.id);
    return Response.json({ success: true, data: members });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/organizations/[id]/members - Add a member
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError();
    }

    // Check permission to add members
    const canEdit = await canEditOrganization(user.id, params.id);
    if (!canEdit) {
      return Response.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { profile_id, role, permissions } = body;

    const member = await addOrganizationMember(params.id, profile_id, role, user.id, permissions);

    return Response.json({ success: true, data: member });
  } catch (error) {
    return handleApiError(error);
  }
}
```

#### Step 3.2: Projects API

**File:** `/src/app/api/projects/route.ts`

```typescript
import { NextRequest } from 'next/server';
import { createServerClient } from '@/services/supabase/server';
import { getPublicProjects, createProject } from '@/services/supabase/projects';
import { handleApiError, AuthError } from '@/lib/errors';

// GET /api/projects - List public projects
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const projects = await getPublicProjects(limit, offset);
    return Response.json({ success: true, data: projects });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/projects - Create a project
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new AuthError();
    }

    const body = await request.json();

    // If creating for organization, check permissions
    if (body.owner_type === 'organization') {
      const { canEditOrganization } = await import('@/services/supabase/organization-members');
      const canCreate = await canEditOrganization(user.id, body.owner_id);

      if (!canCreate) {
        return Response.json(
          { success: false, error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    } else {
      // For personal projects, ensure owner_id matches user
      body.owner_id = user.id;
    }

    const project = await createProject(body);
    return Response.json({ success: true, data: project });
  } catch (error) {
    return handleApiError(error);
  }
}
```

---

### Phase 4: UI Components (Priority: MEDIUM)

Create React components for managing organizations and projects.

#### Step 4.1: Organization Member Management

**File:** `/src/components/organizations/MemberList.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import type { OrganizationMember } from '@/types/database'

interface MemberListProps {
  organizationId: string
  canManage: boolean
}

export function MemberList({ organizationId, canManage }: MemberListProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMembers()
  }, [organizationId])

  async function fetchMembers() {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/members`)
      const result = await response.json()

      if (result.success) {
        setMembers(result.data)
      }
    } catch (error) {
      console.error('Failed to fetch members:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div>Loading members...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Organization Members</h3>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium">{member.profile_id}</p>
              <p className="text-sm text-gray-600">{member.role}</p>
            </div>

            {canManage && (
              <div className="space-x-2">
                <button className="text-sm text-blue-600">Edit</button>
                <button className="text-sm text-red-600">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {canManage && (
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg">
          Invite Member
        </button>
      )}
    </div>
  )
}
```

#### Step 4.2: Project Creation Form

**File:** `/src/components/projects/CreateProjectForm.tsx`

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProjectFormData } from '@/types/database'

export function CreateProjectForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
    owner_type: 'profile',
    owner_id: '', // Set from auth context
    status: 'planning',
    visibility: 'public'
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()

      if (result.success) {
        router.push(`/projects/${result.data.slug}`)
      }
    } catch (error) {
      console.error('Failed to create project:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
      <div>
        <label className="block text-sm font-medium mb-1">
          Project Name
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Description
        </label>
        <textarea
          value={formData.description || ''}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg"
          rows={4}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Visibility
        </label>
        <select
          value={formData.visibility}
          onChange={(e) => setFormData({
            ...formData,
            visibility: e.target.value as 'public' | 'unlisted' | 'private'
          })}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </div>

      <button
        type="submit"
        className="px-6 py-2 bg-blue-600 text-white rounded-lg"
      >
        Create Project
      </button>
    </form>
  )
}
```

---

## 🧪 Testing Checklist

After implementation, test these scenarios:

### Organization Members

- [ ] Create an organization
- [ ] Add members with different roles (owner, admin, member)
- [ ] Set granular permissions for members
- [ ] Edit member roles
- [ ] Remove members
- [ ] Verify RLS policies work (members can only see what they should)

### Projects

- [ ] Create a personal project
- [ ] Create an organization project
- [ ] Link projects to projects
- [ ] Update project status
- [ ] Change project visibility
- [ ] Delete projects

### Permissions

- [ ] Organization owners can manage all settings
- [ ] Organization admins can manage members
- [ ] Regular members cannot edit organization
- [ ] Profile owners can only edit their own profiles
- [ ] Project owners can edit their projects

---

## 🚨 Known Issues & Considerations

1. **Migration Order**: Migrations must be applied in the correct order (organization_members, then projects, then projects update)

2. **Bitcoin Addresses**: You'll need to implement Bitcoin address generation/validation logic

3. **Slug Conflicts**: The auto-slug generator handles conflicts, but test edge cases

4. **Permission Checks**: Always verify permissions on both client and server side

5. **RLS Policies**: Test thoroughly - they're the main security layer

---

## 📚 Next Steps

1. Apply database migrations
2. Create service layer files
3. Build API routes
4. Develop UI components
5. Write tests
6. Deploy and monitor

---

## 🔗 Related Files

- **Architecture**: `/home/g/dev/orangecat/ARCHITECTURE.md`
- **Database Types**: `/home/g/dev/orangecat/src/types/database.ts`
- **Migrations**: `/home/g/dev/orangecat/supabase/migrations/`
- **Existing Services**: `/home/g/dev/orangecat/src/services/supabase/`
- **Existing API Routes**: `/home/g/dev/orangecat/src/app/api/`

---

**Questions?** Refer to ARCHITECTURE.md for entity definitions and relationships.
