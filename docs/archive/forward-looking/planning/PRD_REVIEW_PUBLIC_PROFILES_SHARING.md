# PRD Review: Public Profiles & Sharing

**Created:** 2025-01-30  
**Last Modified:** 2025-01-30  
**Last Modified Summary:** Initial comprehensive review of PRD against codebase

## Executive Summary

**Overall Assessment:** ✅ **EXCELLENT PRD** - Well-structured, addresses real problems, technically feasible

**Recommendation:** **APPROVE with modifications** - The PRD correctly identifies critical issues and proposes solid solutions. However, several technical adjustments are needed based on the current codebase architecture.

---

## ✅ What the PRD Gets Right

### 1. Problem Identification

- ✅ Correctly identifies that `/me` is private-only
- ✅ Correctly identifies project pages show "Loading..." when shared (client-side rendering)
- ✅ Correctly identifies missing public profile URLs
- ✅ Impact assessment is accurate

### 2. Solution Approach

- ✅ Public profile URLs are the right solution
- ✅ Server-side rendering for social sharing is correct
- ✅ Open Graph tags are essential (already partially implemented)
- ✅ Priority phases are logical

### 3. User Stories

- ✅ Well-defined user flows
- ✅ Clear success metrics

---

## ⚠️ Technical Issues & Recommendations

### CRITICAL: Route Structure Conflict

**PRD Suggests:** `/username` or `/profiles/@username`

**Current State:**

- Profile route exists at `/profile/[username]` but is **authenticated-only** (`(authenticated)` folder)
- Route constant: `ROUTES.PROFILE.VIEW(username)` → `/profile/${username}`
- No public profile route exists

**Recommendation:**
**Option A (Recommended):** Use `/profiles/[username]` for public profiles

- Keeps `/profile/[username]` for authenticated user's own profile
- Clear separation: `/profiles/` = public, `/profile/` = own profile
- Avoids conflicts with other routes

**Option B:** Use `/@[username]` pattern (like Twitter/X)

- More modern, social-media-like
- Requires middleware to handle `@` prefix
- May conflict with existing routes

**Option C:** Use `/username` directly (PRD suggestion)

- Simplest URL structure
- **RISK:** Could conflict with existing routes (`/discover`, `/projects`, etc.)
- Need careful route ordering

**My Recommendation:** **Option A** - `/profiles/[username]` is safest and clearest.

---

### CRITICAL: Server-Side Rendering Implementation

**PRD Suggests:** "Server-side rendered or pre-rendered"

**Current State:**

- Project pages are **100% client-side** (`'use client'` directive)
- Uses `useEffect` + `fetch` pattern (causes "Loading..." on social crawlers)
- `SocialMetaTags` component uses **wrong API** (`next/head` instead of Next.js metadata API)

**Technical Reality:**

- Next.js 15.3.3 App Router is being used
- Some pages already use `generateMetadata` (blog posts, demo pages)
- Need to convert project pages to **Server Components** with `generateMetadata`

**Required Changes:**

1. **Convert Project Page to Server Component:**

```typescript
// Current: src/app/projects/[id]/page.tsx
'use client'; // ❌ Remove this

// New: Server Component with metadata
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await fetchProject(id); // Server-side fetch

  return {
    title: project.title,
    description: project.description,
    openGraph: {
      title: project.title,
      description: project.description,
      images: [project.image || '/og-default.png'],
      url: `https://orangecat.ch/projects/${id}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description,
    },
  };
}

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await fetchProject(id); // Server-side fetch

  return <ProjectPageClient project={project} />; // Client component for interactivity
}
```

2. **Fix SocialMetaTags Component:**

- Current: Uses `next/head` (Pages Router API)
- Required: Use Next.js 15 `Metadata` API (App Router)
- **Action:** Delete `SocialMetaTags.tsx` or refactor to use metadata API

---

### Database Schema Assessment

**PRD Questions:** "Do we need schema changes?"

**Current State:**

- ✅ `username` field exists and is **UNIQUE** (verified via migrations)
- ✅ `name` exists (standardized from `display_name` - see SCHEMA_CONSISTENCY_FIX.md)
- ✅ `bio` exists
- ✅ `avatar_url` exists
- ✅ `banner_url` exists
- ✅ `bitcoin_address` exists
- ✅ `lightning_address` exists

**Answer:** **NO SCHEMA CHANGES NEEDED** - All required fields already exist!

**Optional Enhancements:**

- Consider adding `profile_public` boolean (default: true) for privacy control
- Consider adding `profile_views` counter (already exists in some migrations)
- Consider adding `last_active_at` for "last seen" feature

---

### Privacy & Visibility Concerns

**PRD Question:** "Should profiles be public by default?"

**Current State:**

- Profiles table has no `visibility` or `is_public` field
- RLS (Row Level Security) policies need verification
- Current profile route requires authentication

**Recommendation:**

1. **Phase 1:** Make profiles public by default (no schema change needed)
2. **Phase 2:** Add `profile_visibility` enum field: `'public' | 'unlisted' | 'private'`
3. **Phase 3:** Add privacy settings UI in profile settings

**RLS Policy Check Needed:**

```sql
-- Need to verify this exists:
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true); -- Or: USING (profile_visibility = 'public')
```

---

### Wallet Visibility

**PRD Question:** "Should wallet address always be public?"

**Current State:**

- Bitcoin addresses are stored in `profiles.bitcoin_address`
- No privacy control for wallet visibility

**Recommendation:**

- **Default:** Public (Bitcoin addresses are public by design)
- **Optional:** Add `wallet_visibility` field if users want to hide it
- **Note:** Hiding wallet addresses defeats the purpose of Bitcoin transparency

---

## 📋 Implementation Checklist (Revised)

### Phase 1 (Must Have - This Week)

#### 1.1 Create Public Profile Route ✅

- [ ] Create `src/app/profiles/[username]/page.tsx` (public route, outside `(authenticated)`)
- [ ] Implement server-side data fetching
- [ ] Add `generateMetadata` for SEO
- [ ] Handle 404 for non-existent usernames
- [ ] Add route constant: `ROUTES.PROFILES.VIEW(username)`

#### 1.2 Convert Project Pages to Server Components ✅

- [ ] Remove `'use client'` from `src/app/projects/[id]/page.tsx`
- [ ] Create server-side `fetchProject` function
- [ ] Implement `generateMetadata` with Open Graph tags
- [ ] Split into Server Component (data) + Client Component (interactivity)
- [ ] Test social media preview cards (Twitter, Facebook, LinkedIn)

#### 1.3 Fix SocialMetaTags Component ✅

- [ ] **Option A:** Delete component, use `generateMetadata` instead
- [ ] **Option B:** Refactor to helper function that returns Metadata object
- [ ] Update all pages using `SocialMetaTags` to use `generateMetadata`

#### 1.4 Update Route Constants ✅

- [ ] Add `PROFILES.VIEW(username)` to `ROUTES` object
- [ ] Update all profile links to use new route
- [ ] Add redirect from old `/profile/[username]` to `/profiles/[username]` (if needed)

---

### Phase 2 (Should Have - Next Week)

#### 2.1 Profile Page Enhancements ✅

- [ ] Display user's projects list
- [ ] Display wallet address (if public)
- [ ] Add "Support this person" CTA
- [ ] Show statistics (project count, total raised, etc.)
- [ ] Add profile picture display

#### 2.2 Wallet Transaction History ✅

- [ ] Create API endpoint: `/api/profiles/[username]/transactions`
- [ ] Display recent transactions (last 10)
- [ ] Add link to blockchain explorer
- [ ] Show wallet balance (if available)

#### 2.3 SEO Optimization ✅

- [ ] Add structured data (JSON-LD) for profiles
- [ ] Add structured data for projects
- [ ] Generate sitemap entries for public profiles
- [ ] Add canonical URLs

---

### Phase 3 (Nice to Have)

#### 3.1 Privacy Controls ✅

- [ ] Add `profile_visibility` field to database
- [ ] Create privacy settings UI
- [ ] Update RLS policies
- [ ] Add "Unlisted" profile option

#### 3.2 Enhanced Features ✅

- [ ] User follows/subscriptions
- [ ] Activity feed on profile
- [ ] Profile badges/reputation system
- [ ] Profile customization (colors, themes)

---

## 🔧 Technical Implementation Details

### 1. Public Profile Route Structure

**File:** `src/app/profiles/[username]/page.tsx`

```typescript
import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import PublicProfileClient from '@/components/profile/PublicProfileClient';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createServerClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, bio, avatar_url') // Note: Schema uses 'name' field
    .eq('username', username)
    .single();

  if (!profile) {
    return {
      title: 'Profile Not Found | OrangeCat',
    };
  }

  return {
    title: `${profile.name || username} | OrangeCat`,
    description: profile.bio || `View ${profile.name || username}'s profile on OrangeCat`,
    openGraph: {
      title: `${profile.name || username} on OrangeCat`,
      description: profile.bio || `Support ${profile.name || username}'s work`,
      images: profile.avatar_url ? [profile.avatar_url] : ['/og-default.png'],
      url: `https://orangecat.ch/profiles/${username}`,
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `${profile.name || username}`,
      description: profile.bio || '',
    },
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createServerClient();

  // Fetch profile data server-side
  const { data: profile, error } = await supabase
    .from('profiles')
    .select(`
      *,
      projects:projects(*)
    `)
    .eq('username', username)
    .single();

  if (error || !profile) {
    return <ProfileNotFound username={username} />;
  }

  return <PublicProfileClient profile={profile} />;
}
```

### 2. Project Page Server Component Conversion

**File:** `src/app/projects/[id]/page.tsx` (refactored)

```typescript
import { Metadata } from 'next';
import { createServerClient } from '@/lib/supabase/server';
import ProjectPageClient from '@/components/project/ProjectPageClient';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: project } = await supabase
    .from('projects')
    .select(`
      title,
      description,
      goal_amount,
      raised_amount,
      currency,
      bitcoin_address,
      profiles:user_id (username, name) // Note: Schema uses 'name' field
    `)
    .eq('id', id)
    .single();

  if (!project) {
    return {
      title: 'Project Not Found | OrangeCat',
    };
  }

  const progress = project.goal_amount
    ? Math.round((project.raised_amount / project.goal_amount) * 100)
    : 0;

  return {
    title: `${project.title} | OrangeCat`,
    description: project.description || `Support ${project.title} on OrangeCat`,
    openGraph: {
      title: project.title,
      description: project.description || '',
      images: [`/api/projects/${id}/og-image`], // Generate OG image
      url: `https://orangecat.ch/projects/${id}`,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: project.title,
      description: project.description || '',
    },
  };
}

export default async function PublicProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      profiles:user_id (*)
    `)
    .eq('id', id)
    .single();

  if (error || !project) {
    return <ProjectNotFound id={id} />;
  }

  return <ProjectPageClient project={project} />;
}
```

### 3. Route Constants Update

**File:** `src/lib/routes.ts`

```typescript
export const ROUTES = {
  // ... existing routes ...

  // Profile routes
  PROFILE: {
    VIEW: (username: string) => `/profile/${username}`, // Own profile (authenticated)
    SETTINGS: '/profile/settings',
  },

  // Public profile routes (NEW)
  PROFILES: {
    VIEW: (username: string) => `/profiles/${username}`, // Public profile
  },
} as const;
```

---

## 🚨 Critical Issues to Address

### 1. SocialMetaTags Component is Broken

**Current:** Uses `next/head` (Pages Router API)  
**Required:** Next.js 15 App Router uses `generateMetadata`  
**Impact:** Social sharing meta tags don't work properly

**Action:**

- Delete `src/components/seo/SocialMetaTags.tsx`
- Replace all usages with `generateMetadata` functions
- Update documentation

### 2. Profile Route Requires Authentication

**Current:** `/profile/[username]` is in `(authenticated)` folder  
**Required:** Public profiles need separate route  
**Impact:** Users can't share their profiles

**Action:**

- Create `/profiles/[username]` route (public)
- Keep `/profile/[username]` for authenticated user's own profile
- Update all profile links

### 3. Project Pages Show "Loading..." on Social Media

**Current:** Client-side rendering with `useEffect`  
**Required:** Server-side rendering with metadata  
**Impact:** No preview cards on social media

**Action:**

- Convert to Server Components
- Implement `generateMetadata`
- Test with Twitter Card Validator, Facebook Debugger

---

## ✅ What Already Exists (Good News!)

1. ✅ **Database Schema:** All required fields exist (username, name, bio, avatar_url, etc.) - Note: `name` standardized from `display_name`
2. ✅ **Sharing Components:** `CampaignShare` and `ShareButton` exist (need integration)
3. ✅ **Route Constants:** System exists, just needs extension
4. ✅ **Profile Components:** `UnifiedProfileLayout` exists (can be reused)
5. ✅ **Project Components:** All UI components exist, just need server-side data fetching

---

## 📊 Estimated Effort

### Phase 1 (Critical)

- **Public Profile Route:** 4-6 hours
- **Project Page SSR:** 6-8 hours
- **SocialMetaTags Fix:** 2-3 hours
- **Testing:** 2-3 hours
- **Total:** 14-20 hours

### Phase 2 (Important)

- **Profile Enhancements:** 8-10 hours
- **Transaction History:** 6-8 hours
- **SEO Optimization:** 4-6 hours
- **Total:** 18-24 hours

### Phase 3 (Nice to Have)

- **Privacy Controls:** 8-10 hours
- **Enhanced Features:** 16-20 hours
- **Total:** 24-30 hours

---

## 🎯 Recommendations

### Option 1: Follow PRD Exactly (Not Recommended)

- Use `/username` route (risky, may conflict)
- Keep current SocialMetaTags approach (broken)
- **Risk:** Route conflicts, broken social sharing

### Option 2: Implement with Technical Corrections (Recommended) ✅

- Use `/profiles/[username]` for public profiles
- Convert to Server Components with `generateMetadata`
- Fix SocialMetaTags by removing it
- **Benefit:** Clean implementation, no conflicts, proper SSR

### Option 3: Phased Approach with Privacy First

- Phase 1: Public profiles + SSR (as above)
- Phase 2: Add privacy controls before making everything public
- **Benefit:** Users have control from day one

**My Recommendation:** **Option 2** - Implement with technical corrections. The PRD is excellent, but these technical adjustments are necessary for a production-ready implementation.

---

## 📝 Questions for Clarification

1. **Route Structure:** Do you prefer `/profiles/[username]` or `/username`? (I recommend `/profiles/[username]`)

2. **Privacy Default:** Should profiles be public by default, or opt-in?

3. **Wallet Visibility:** Should Bitcoin addresses always be public, or allow hiding?

4. **Profile Picture:** Is avatar upload already working, or do we need to implement it?

5. **Project Thumbnails:** Do projects have images, or should we auto-generate OG images?

---

## Conclusion

**PRD Quality:** ⭐⭐⭐⭐⭐ (5/5) - Excellent structure, clear problem definition, logical solutions

**Technical Feasibility:** ✅ **100% Feasible** - All required infrastructure exists

**Recommended Action:** **APPROVE and implement with technical corrections** outlined above

The PRD correctly identifies critical issues and proposes solid solutions. With the technical adjustments I've outlined, this will be a clean, production-ready implementation that solves the sharing problem completely.
