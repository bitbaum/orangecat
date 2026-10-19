# Timeline X-Like Implementation Plan

**created_date:** 2025-01-27  
**last_modified_date:** 2025-01-27  
**last_modified_summary:** Initial implementation plan for X-like timeline with threading

## Overview

Transform the current timeline into an X-like experience with proper threading to enable networked thoughts and collective consciousness.

---

## Phase 1: Visual Redesign (Week 1)

### 1.1 Post Card Redesign

**Current**: Card-based with borders, padding, shadows  
**Target**: X-like minimal design with clean lines

**Changes**:

```tsx
// Before: Card with borders
<Card className="border border-gray-200 p-4">

// After: X-like minimal
<div className="border-b border-gray-200 px-4 py-3 hover:bg-gray-50/50">
```

**Components to Update**:

- `src/components/timeline/PostCard.tsx`
- `src/components/timeline/PostHeader.tsx`
- `src/components/timeline/PostContent.tsx`
- `src/components/timeline/PostActions.tsx`

**Design Principles**:

- Remove card borders (use bottom border only)
- Reduce padding (px-4 py-3 instead of p-4)
- Subtle hover states (bg-gray-50/50)
- Cleaner typography (text-sm for content, text-xs for metadata)
- Better spacing between elements

### 1.2 Thread Visualization

**Add Visual Thread Lines**:

```tsx
// Thread line component
<div className="flex gap-3">
  {/* Thread line */}
  <div className="w-0.5 bg-gray-300 ml-6 -mt-2 mb-2" />

  {/* Post content */}
  <div className="flex-1">{/* Post */}</div>
</div>
```

**Components to Create**:

- `src/components/timeline/ThreadLine.tsx` - Visual thread connector
- `src/components/timeline/ThreadPost.tsx` - Post within thread context

**Features**:

- Vertical line connecting posts in thread
- Indentation for nested replies
- Collapsible thread branches
- Thread depth indicators

### 1.3 Mobile Optimization

**Responsive Design**:

- Stack layout on mobile
- Touch-friendly action buttons
- Swipe gestures for actions
- Bottom sheet for thread view

---

## Phase 2: Quote Reply System (Week 2)

### 2.1 Database Schema Updates

**Add Thread Relationships**:

```sql
-- Add to timeline_events table (if not exists)
ALTER TABLE timeline_events
  ADD COLUMN IF NOT EXISTS parent_post_id uuid REFERENCES timeline_events(id),
  ADD COLUMN IF NOT EXISTS thread_id uuid REFERENCES timeline_events(id),
  ADD COLUMN IF NOT EXISTS thread_depth integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_quote_reply boolean DEFAULT false;

-- Index for thread queries
CREATE INDEX IF NOT EXISTS idx_timeline_events_thread_id
  ON timeline_events(thread_id);

CREATE INDEX IF NOT EXISTS idx_timeline_events_parent_post_id
  ON timeline_events(parent_post_id);
```

**Migration File**:

- `supabase/migrations/20250127_add_threading_support.sql`

### 2.2 Quote Reply API

**New Endpoint**:

```typescript
// src/app/api/timeline/quote-reply/route.ts
POST /api/timeline/quote-reply
{
  parentPostId: string,
  content: string,
  quotedContent: string, // Excerpt from parent
  visibility: 'public' | 'private'
}
```

**Service Method**:

```typescript
// src/services/timeline/index.ts
async createQuoteReply(
  parentPostId: string,
  content: string,
  quotedContent: string
): Promise<TimelineEventResponse> {
  // 1. Get parent post
  // 2. Determine thread_id (parent's thread_id or parent's id)
  // 3. Calculate thread_depth
  // 4. Create new post with quote_reply type
  // 5. Return enriched post
}
```

### 2.3 Quote Reply UI

**Component**:

```tsx
// src/components/timeline/QuoteReplyComposer.tsx
<QuoteReplyComposer
  parentPost={post}
  onReply={content => {
    // Create quote reply
  }}
/>
```

**Features**:

- Show parent post preview
- Text input for reply
- Quote excerpt selection
- Thread context display

---

## Phase 3: Thread Navigation (Week 3)

### 3.1 Thread Context View

**Component**:

```tsx
// src/components/timeline/ThreadContext.tsx
<ThreadContext
  threadId={threadId}
  currentPostId={postId}
  onNavigate={postId => {
    // Navigate to post in thread
  }}
/>
```

**Features**:

- Show all posts in thread
- Highlight current post
- Navigate to any post in thread
- Show thread participants
- Thread timeline view

### 3.2 Thread Discovery

**Thread Indicators**:

```tsx
// Add to PostCard
{
  post.threadDepth > 0 && (
    <div className="flex items-center gap-1 text-xs text-gray-500">
      <MessageCircle className="w-3 h-3" />
      <span>Part of thread ({post.threadRepliesCount} replies)</span>
    </div>
  );
}
```

**Thread Feed**:

```typescript
// New feed type: 'threads'
async getThreadFeed(
  threadId: string
): Promise<TimelineFeedResponse> {
  // Get all posts in thread
  // Order by thread_depth, then created_at
  // Return as timeline feed
}
```

### 3.3 Thread Actions

**Show Thread Button**:

```tsx
<Button onClick={() => showThread(post.threadId)} variant="ghost" size="sm">
  <MessageCircle className="w-4 h-4" />
  Show thread ({post.threadRepliesCount})
</Button>
```

**Thread Modal/Sheet**:

```tsx
<ThreadView threadId={threadId} isOpen={isOpen} onClose={onClose} />
```

---

## Implementation Details

### Database Functions

**Create Thread Function**:

```sql
CREATE OR REPLACE FUNCTION create_quote_reply(
  p_parent_post_id uuid,
  p_actor_id uuid,
  p_content text,
  p_quoted_content text,
  p_visibility text DEFAULT 'public'
) RETURNS uuid AS $$
DECLARE
  v_thread_id uuid;
  v_thread_depth integer;
  v_post_id uuid;
BEGIN
  -- Get parent post's thread_id (or use parent's id as thread root)
  SELECT COALESCE(thread_id, id), thread_depth + 1
  INTO v_thread_id, v_thread_depth
  FROM timeline_events
  WHERE id = p_parent_post_id;

  -- Create quote reply post
  INSERT INTO timeline_events (
    event_type,
    actor_id,
    subject_type,
    subject_id,
    title,
    description,
    visibility,
    parent_post_id,
    thread_id,
    thread_depth,
    is_quote_reply,
    metadata
  ) VALUES (
    'quote_reply',
    p_actor_id,
    'profile',
    p_actor_id,
    'Replied to post',
    p_content,
    p_visibility,
    p_parent_post_id,
    v_thread_id,
    v_thread_depth,
    true,
    jsonb_build_object('quoted_content', p_quoted_content)
  ) RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$ LANGUAGE plpgsql;
```

**Get Thread Function**:

```sql
CREATE OR REPLACE FUNCTION get_thread_posts(
  p_thread_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
) RETURNS TABLE (
  -- All timeline_events columns
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM timeline_events
  WHERE thread_id = p_thread_id
    AND is_deleted = false
  ORDER BY thread_depth ASC, created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
```

### Type Updates

**Add to `src/types/timeline.ts`**:

```typescript
export interface TimelineDisplayEvent {
  // ... existing fields
  parentPostId?: string;
  threadId?: string;
  threadDepth?: number;
  isQuoteReply?: boolean;
  threadRepliesCount?: number;
  quotedContent?: string;
  threadParticipants?: Array<{
    id: string;
    name: string;
    username: string;
    avatar?: string;
  }>;
}
```

### Component Structure

```
src/components/timeline/
├── PostCard.tsx (update)
├── PostHeader.tsx (update)
├── PostContent.tsx (update)
├── PostActions.tsx (update)
├── ThreadLine.tsx (new)
├── ThreadPost.tsx (new)
├── QuoteReplyComposer.tsx (new)
├── ThreadContext.tsx (new)
├── ThreadView.tsx (new)
└── ThreadIndicator.tsx (new)
```

---

## Testing Strategy

### Unit Tests

- Thread creation logic
- Thread depth calculation
- Thread navigation
- Quote reply formatting

### Integration Tests

- Quote reply creation flow
- Thread loading and display
- Thread navigation
- Thread context view

### E2E Tests

- Create quote reply
- Navigate thread
- View thread context
- Thread discovery

---

## Migration Path

### Step 1: Visual Redesign (Non-Breaking)

- Update PostCard styling
- Add thread visualization
- No database changes
- Can deploy immediately

### Step 2: Database Schema (Breaking)

- Add threading columns
- Create migration
- Update existing posts (set thread_id = id for root posts)
- Deploy with code update

### Step 3: Quote Reply Feature (New Feature)

- Add quote reply UI
- Add quote reply API
- Test thoroughly
- Deploy

### Step 4: Thread Navigation (Enhancement)

- Add thread context view
- Add thread discovery
- Add thread indicators
- Deploy

---

## Success Criteria

### Visual

- [ ] Timeline looks like X (minimal, clean)
- [ ] Thread lines visible and clear
- [ ] Mobile experience is excellent
- [ ] Hover states are subtle and appropriate

### Functionality

- [ ] Quote replies work correctly
- [ ] Thread relationships are accurate
- [ ] Thread navigation is intuitive
- [ ] Thread discovery helps users find conversations

### Performance

- [ ] Thread loading is fast (< 200ms)
- [ ] Thread queries are optimized
- [ ] No N+1 query problems
- [ ] Smooth scrolling in threads

### User Experience

- [ ] Users can easily create quote replies
- [ ] Users can navigate threads easily
- [ ] Thread context is clear
- [ ] Thread indicators are helpful

---

## Next Steps

1. **Review and Approve** this implementation plan
2. **Create Migration** for threading schema
3. **Start Visual Redesign** of PostCard
4. **Implement Quote Reply** functionality
5. **Add Thread Navigation** features
6. **Test Thoroughly** before production
7. **Deploy Incrementally** (visual first, then features)

---

## Long-Term Vision

This implementation enables:

- **Networked Thoughts**: Threads connect related ideas
- **Collective Intelligence**: Threads aggregate knowledge
- **Hive Mind**: Threads enable collective consciousness

**Future Enhancements**:

- Thread summarization (AI-powered)
- Thread topic extraction
- Thread relationship mapping
- Thread influence tracking
- Collective insights dashboard



