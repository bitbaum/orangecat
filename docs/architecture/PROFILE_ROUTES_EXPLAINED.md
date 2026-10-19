# Profile Routes Architecture

**Created:** 2025-01-30  
**Last Modified:** 2025-01-30  
**Last Modified Summary:** Initial documentation of profile routing architecture

## Overview

OrangeCat has two types of profile routes that serve different purposes:

1. **`/profiles/me`** - Convenience route for authenticated users to view their own profile
2. **`/profiles/[username]`** - Public profile route for viewing any user's profile by username

## Route Details

### `/profiles/me`

**Purpose:** Convenience route for authenticated users to quickly access their own profile.

**Behavior:**

- Resolves to the current authenticated user's actual username server-side
- If not authenticated, redirects to `/auth?redirect=/profiles/me`
- If user has no username, falls back to user ID
- **Note:** This route is NOT ideal for SEO or sharing - it shows "me" in the URL

**Use Cases:**

- Internal navigation (sidebar, dropdown menus)
- Quick access to own profile
- User-friendly convenience route

**Example:**

- User "mao" visits `/profiles/me` → Shows mao's profile
- Page title: "mao | OrangeCat" (resolved from "me")
- URL still shows `/profiles/me` (not redirected)

### `/profiles/[username]`

**Purpose:** Public, shareable profile route for viewing any user's profile.

**Behavior:**

- Publicly accessible (no authentication required)
- Uses actual username in URL (e.g., `/profiles/mao`)
- Optimized for SEO and social media sharing
- Server-side rendered for fast initial load

**Use Cases:**

- Sharing profile links
- SEO optimization
- Public profile discovery
- Social media preview cards

**Example:**

- Visit `/profiles/mao` → Shows mao's profile
- Page title: "mao | OrangeCat"
- URL shows `/profiles/mao` (canonical URL)

## Technical Implementation

### Metadata Generation

Both routes use the same `generateMetadata` function which:

1. Handles "me" case by resolving to actual username
2. Fetches profile data from database
3. Generates proper SEO metadata with actual username
4. Creates Open Graph tags for social sharing

### Server-Side Resolution

When `/profiles/me` is accessed:

1. `generateMetadata` runs first and resolves "me" → actual username
2. Page component also resolves "me" → actual username
3. Profile is fetched using actual username
4. Page renders with correct data

### Best Practices

**✅ DO:**

- Use `/profiles/me` for internal navigation
- Use `/profiles/[username]` for sharing and public links
- Always resolve "me" to actual username in metadata
- Use actual username in canonical URLs

**❌ DON'T:**

- Don't share `/profiles/me` links (use actual username)
- Don't hardcode "me" in metadata
- Don't query database with username="me"

## Future Improvements

### Option 1: Redirect `/profiles/me` → `/profiles/[username]`

**Pros:**

- Better SEO (canonical URLs)
- Cleaner URLs when shared
- Follows REST best practices

**Cons:**

- Breaks existing internal links
- Requires updating all references
- More redirect overhead

**Implementation:**

```typescript
// In page.tsx
if (username === 'me') {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();

    if (profile?.username) {
      redirect(`/profiles/${profile.username}`, RedirectType.permanent);
    }
  }
}
```

### Option 2: Keep Both Routes (Current Approach)

**Pros:**

- User-friendly convenience route
- No breaking changes
- Flexible for different use cases

**Cons:**

- Two URLs for same content (duplicate content)
- "me" route not ideal for SEO
- Can be confusing

## Current Status

✅ **Fixed:** Metadata generation now properly handles "me" case  
✅ **Fixed:** Page titles show actual username, not "Profile Not Found"  
✅ **Fixed:** Structured data uses actual username  
⚠️ **Consider:** Redirecting `/profiles/me` to `/profiles/[username]` for better SEO

## Related Files

- `src/app/profiles/[username]/page.tsx` - Main profile page component
- `src/app/(authenticated)/profile/page.tsx` - Redirects `/profile` → `/profiles/me`
- `src/config/navigation.ts` - Navigation links using `/profiles/me`
