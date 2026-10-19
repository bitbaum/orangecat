# Timeline Architecture Documentation

**created_date:** 2025-11-13
**last_modified_date:** 2025-11-14
**last_modified_summary:** Renamed SocialTimeline component and aligned documentation with new posting flow.
**Version:** 2.0 (Modular Architecture)

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Architecture Layers](#architecture-layers)
4. [Component Reference](#component-reference)
5. [Data Flow](#data-flow)
6. [Timeline Visibility Rules](#timeline-visibility-rules)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)

---

## Overview

The OrangeCat timeline system is a **modular, DRY, and type-safe** activity feed that powers user journeys, community feeds, profile timelines, and project timelines. It's built following these principles:

- **DRY (Don't Repeat Yourself)**: Reusable components across all contexts
- **Modularity**: Separate concerns (data, presentation, composition)
- **Progressive Exposure**: Load data only when needed
- **Type Safety**: Full TypeScript support
- **Performance**: Optimized queries using database VIEWs

---

## Core Concepts

### Timeline Ownership Model

Every post has two key identifiers:

- **`actor_id`**: WHO wrote the post (always the authenticated user)
- **`subject_id`**: WHOSE timeline it appears on (profile, project, etc.)

This enables **cross-posting** and **reputation-based transparency**.

### Timeline Types

| Type          | Description               | Filters By               | Use Case                   |
| ------------- | ------------------------- | ------------------------ | -------------------------- |
| **Journey**   | User's personal timeline  | `actor_id = userId`      | Shows posts I wrote        |
| **Community** | Global public feed        | `visibility = public`    | Shows all public posts     |
| **Profile**   | Specific user's timeline  | `subject_id = profileId` | Posts on someone's profile |
| **Project**   | Specific project timeline | `subject_id = projectId` | Posts about a project      |

### Cross-Posting

When posting, users can:

1. Post to their own journey (default)
2. Post to someone else's profile
3. Post to one or more project timelines

All posts appear in the **Community** feed if visibility is `public`.

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    TIMELINE ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  🗄️ DATA LAYER (timelineService)                            │
│  ├─ getEnrichedUserFeed(userId)    → actor_id = userId      │
│  ├─ getProfileFeed(profileId)      → subject_id = profileId │
│  ├─ getProjectFeed(projectId)      → subject_id = projectId │
│  ├─ getCommunityFeed()              → all public posts      │
│  └─ createEvent(...)                → create new posts      │
│                                                              │
│  🧩 COMPONENT LAYER (Reusable)                              │
│  ├─ TimelineView                    → Fetches & displays    │
│  ├─ TimelineComposer                → Creates posts         │
│  ├─ TimelineComponent               → Renders events        │
│  └─ SocialTimeline                  → Full-page timeline    │
│                                                              │
│  📄 PAGE LAYER (Configuration)                              │
│  ├─ /journey                        → SocialTimeline        │
│  ├─ /community                      → SocialTimeline        │
│  ├─ /profiles/:id (Timeline Tab)   → TimelineView          │
│  └─ /projects/:id                   → TimelineView          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Reference

### 🧩 `TimelineView`

**Purpose**: Universal timeline display component
**Location**: `src/components/timeline/TimelineView.tsx`
**Usage**: Profile timelines, project timelines

```tsx
<TimelineView
  feedType="profile" // 'journey' | 'community' | 'profile' | 'project'
  ownerId={profile.id} // Required for profile/project
  ownerType="profile" // 'profile' | 'project'
  showComposer={false}
  compact={false}
  showFilters={false}
  onPostCreated={() => {}}
/>
```

**Features:**

- ✅ Fetches data automatically based on `feedType`
- ✅ Handles loading, error, and empty states
- ✅ Supports pagination
- ✅ Modular and reusable

---

### ✍️ `TimelineComposer`

**Purpose**: Universal post creation component
**Location**: `src/components/timeline/TimelineComposer.tsx`
**Usage**: Any timeline context

```tsx
<TimelineComposer
  targetOwnerId={profile.id} // Where post will appear
  targetOwnerType="profile" // 'profile' | 'project'
  targetOwnerName="John Doe"
  allowProjectSelection={true} // Enable cross-posting to projects
  onPostCreated={() => {}}
  showBanner={true} // Show context banner
/>
```

**Features:**

- ✅ Cross-posting to multiple project timelines
- ✅ Context-aware (shows whose timeline you're posting on)
- ✅ Character counter (500 max)
- ✅ Keyboard shortcuts (Ctrl+Enter to post)
- ✅ Project selection UI

---

### 📱 `SocialTimeline`

**Purpose**: Full-page timeline with header, stats, and composer
**Location**: `src/components/timeline/SocialTimeline.tsx`
**Usage**: Journey and Community pages

```tsx
<SocialTimeline
  title="My Journey"
  description="Your personal timeline"
  icon={BookOpen}
  mode="journey" // 'journey' | 'community'
  showInlineComposer={true}
  defaultSort="recent"
/>
```

**Features:**

- ✅ Integrated composer with project selection
- ✅ Sorting controls (trending, recent, popular)
- ✅ Stats display
- ✅ Beautiful header with gradients

---

### 📋 `TimelineComponent`

**Purpose**: Renders timeline events (cards)
**Location**: `src/components/timeline/TimelineComponent.tsx`
**Usage**: Used by TimelineView and SocialTimeline

```tsx
<TimelineComponent
  feed={timelineFeed}
  onEventUpdate={(eventId, updates) => {}}
  onLoadMore={() => {}}
  showFilters={false}
  compact={false}
/>
```

**Features:**

- ✅ Like, comment, share interactions
- ✅ Edit and delete (for post owners)
- ✅ Load more pagination
- ✅ Twitter-like UI

---

## Data Flow

### Creating a Post

```
User writes post
     ↓
TimelineComposer
     ↓
timelineService.createEvent({
  actorId: user.id,           // WHO wrote it
  subjectId: profile.id,      // WHOSE timeline
  subjectType: 'profile',
  title: 'Shared an update',
  description: content,
})
     ↓
Database (timeline_events table)
     ↓
enriched_timeline_events VIEW
     ↓
Appears on relevant timelines
```

### Reading a Timeline

```
User visits profile
     ↓
TimelineView (feedType="profile", ownerId=profile.id)
     ↓
timelineService.getProfileFeed(profile.id)
     ↓
Query: enriched_timeline_events WHERE subject_id = profile.id
     ↓
Returns TimelineFeedResponse
     ↓
TimelineComponent renders events
```

---

## Timeline Visibility Rules

| Post Source                 | Journey | Community | Profile            | Project               |
| --------------------------- | ------- | --------- | ------------------ | --------------------- |
| Post on **my journey**      | ✅      | ✅        | ✅ (my profile)    | ❌                    |
| Post on **another profile** | ❌      | ✅        | ✅ (their profile) | ❌                    |
| Post on **project**         | ❌      | ✅        | ❌                 | ✅ (project timeline) |
| Cross-post to **project**   | ✅      | ✅        | ✅                 | ✅ (all selected)     |

### Key Rules:

1. **Journey shows posts I wrote** (`actor_id = my_id`)
2. **Profile shows posts on that profile** (`subject_id = profile_id`)
3. **Project shows posts on that project** (`subject_id = project_id`)
4. **Community shows ALL public posts**

---

## Best Practices

### 1. Use Modular Components

❌ **Don't duplicate logic:**

```tsx
// Bad: Custom timeline logic everywhere
function ProfilePage() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    // Custom fetch logic...
  }, []);
  return <div>{/* Custom render */}</div>;
}
```

✅ **Use reusable components:**

```tsx
// Good: Use TimelineView
function ProfilePage() {
  return <TimelineView feedType="profile" ownerId={profileId} />;
}
```

### 2. Separate Data from Presentation

```tsx
// Good: TimelineView fetches, TimelineComponent renders
<TimelineView feedType="journey" />
```

### 3. Use Proper TypeScript Types

```tsx
import { TimelineFeedResponse, TimelineDisplayEvent } from '@/types/timeline';
```

### 4. Handle Loading States

```tsx
<Suspense fallback={<LoadingSkeleton />}>
  <TimelineView feedType="profile" ownerId={id} />
</Suspense>
```

---

## Common Patterns

### Pattern 1: Profile Timeline Tab

```tsx
export default function ProfileTimelineTab({ profile }: Props) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <TimelineComposer
        targetOwnerId={profile.id}
        targetOwnerType="profile"
        allowProjectSelection={true}
        onPostCreated={() => setRefreshKey(prev => prev + 1)}
      />

      <TimelineView key={refreshKey} feedType="profile" ownerId={profile.id} />
    </>
  );
}
```

### Pattern 2: Journey Page

```tsx
export default function JourneyPage() {
  return <SocialTimeline title="My Journey" mode="journey" showInlineComposer={true} />;
}
```

### Pattern 3: Cross-Posting

```tsx
// Posts appear on both profile AND selected projects
<TimelineComposer
  targetOwnerId={profile.id}
  allowProjectSelection={true} // User can select projects
/>
```

---

## Database Schema

### Key Tables

**`timeline_events`**

- Stores all timeline posts
- Fields: `id`, `actor_id`, `subject_id`, `subject_type`, `title`, `description`, etc.

**`enriched_timeline_events` (VIEW)**

- Pre-joins actor, subject, target data
- Eliminates N+1 queries
- Used by all feed methods for performance

### RLS Policies

```sql
-- Anyone can post on any timeline
CREATE POLICY "Anyone can post on any timeline"
  ON timeline_events FOR INSERT
  WITH CHECK (auth.uid() = actor_id);

-- Public posts visible to everyone
CREATE POLICY "Anyone can view public timeline events"
  ON timeline_events FOR SELECT
  USING (visibility = 'public' AND NOT is_deleted);
```

---

## Migration Guide

### Old Architecture → New Architecture

**Before (SocialTimeline everywhere):**

```tsx
<SocialTimeline timelineOwnerId={profile.id} showInlineComposer={true} defaultSort="trending" />
```

**After (Modular components):**

```tsx
<TimelineComposer targetOwnerId={profile.id} allowProjectSelection />
<TimelineView feedType="profile" ownerId={profile.id} />
```

---

## Performance Optimizations

1. **Database VIEW**: `enriched_timeline_events` pre-computes joins
2. **Lazy Loading**: Profiles load timeline tab on-demand
3. **Pagination**: Load 20 posts at a time
4. **Suspense**: Progressive loading with skeletons
5. **React Keys**: Efficient re-rendering with refresh keys

---

## Future Enhancements

- [ ] Real-time updates (WebSockets/Supabase Realtime)
- [ ] Infinite scroll (replace load more button)
- [ ] Rich media attachments (images, videos)
- [ ] Hashtags and mentions
- [ ] Advanced filtering (by date, event type, etc.)
- [ ] Search functionality
- [ ] Trending algorithm

---

## Related Documentation

- Timeline types: `src/types/timeline.ts`
- [Database Schema](database-schema.md)
- [API Reference](../reference/api/README.md)

---

**Questions?** Contact the development team or check the inline code documentation.
