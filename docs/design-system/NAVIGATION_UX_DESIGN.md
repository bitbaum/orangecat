# Navigation UX/UI Design: Context-Aware Navigation System

**Created:** 2025-12-30  
**Purpose:** Comprehensive navigation design for individual vs organization context, following best practices from GitHub, Slack, Notion, Linear

> **Status (checked 2026-10-19).** This is the 2025 design. Part of it shipped
> and part did not, so read the code before the sketches below:
>
> - **Shipped:** the context switcher in the sidebar header
>   (`src/components/sidebar/ContextSwitcher.tsx`), backed by
>   `src/hooks/useNavigationContext.ts` (URL-derived context, the user's groups,
>   persisted choice). The sidebar is `src/components/sidebar/Sidebar.tsx`; its
>   sections are SSOT in `src/config/navigation.ts`.
> - **Not built:** a separate group navigation config. The sidebar sections do
>   not swap by context, and there is no `AdaptiveSidebar` component.
> - **Group routes** are `/groups/[slug]` (with `events`, `proposals`,
>   `settings`) and `/dashboard/groups/[slug]`, not the per-entity
>   `/groups/[slug]/products` tree sketched below. Binding governance votes
>   belong to Solon (see `ECOSYSTEM_PILLARS` in `src/config/ecosystem.ts`).
>
> The code blocks below are the original sketches, not the implementation.

---

## 🎯 Core Problem

**User's Concerns:**

1. How to distinguish individual vs organization context?
2. Should individual and organization share the same sidebar?
3. How to avoid navigation bloat?
4. How to handle all entities (assets, loans, products, services, etc.) in both contexts?

---

## 🏆 Expert Team Analysis

**Team of Experts:**

- **Backend Engineers:** Data model, context switching, API design
- **Frontend Engineers:** Component architecture, state management
- **UX Designers:** User flows, information architecture, cognitive load
- **System Designers:** Scalability, extensibility, modularity
- **Product Managers:** User needs, feature prioritization

**Consensus:** **Context Switcher + Adaptive Sidebar** (like GitHub, Slack, Notion)

---

## 🎨 Design Solution: Context Switcher + Adaptive Sidebar

### Core Concept

**Single Sidebar, Multiple Contexts:**

- One sidebar component that adapts based on context
- Context switcher at top of sidebar (or header)
- Clear visual indication of current context
- Unified navigation structure across contexts

---

## 📐 Architecture

### 1. Context Types

```typescript
type NavigationContext =
  | 'individual' // Personal user context
  | 'group'; // Group/organization context

interface NavigationContextData {
  type: NavigationContext;
  id: string;
  name: string;
  slug?: string;
  avatar_url?: string;
  role?: string; // For groups: 'founder' | 'admin' | 'member'
}
```

### 2. Context Switcher Component

**Location:** Top of sidebar (or header)

**Visual Design:**

```
┌─────────────────────────────────┐
│  👤 You                        │ ← Individual context
│  ─────────────────────────────  │
│  🏢 Zurich Bar Collective    ▼  │ ← Group context (active)
│  🏢 Sunset Apartments           │
│  🏢 Bitcoin Builders Guild       │
│  ─────────────────────────────  │
│  ➕ Create Group                 │
└─────────────────────────────────┘
```

**Key Features:**

- Shows current context (highlighted)
- Lists all groups user is member of
- Quick switch between contexts
- Create new group option
- Visual distinction (icon + color)

**Implementation:**

```typescript
// Sketch. Real component: src/components/sidebar/ContextSwitcher.tsx
export function ContextSwitcher() {
  const { context, switchContext } = useNavigationContext();
  const { userGroups } = useUserGroups();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="flex items-center gap-2">
          {context.type === 'individual' ? (
            <UserIcon />
          ) : (
            <Building2 />
          )}
          <span>{context.name}</span>
          <ChevronDown />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {/* Individual option */}
        <DropdownMenuItem onClick={() => switchContext('individual')}>
          <UserIcon /> You
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* Group options */}
        {userGroups.map(group => (
          <DropdownMenuItem
            key={group.id}
            onClick={() => switchContext('group', group.id)}
          >
            <Building2 /> {group.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/groups/create')}>
          <Plus /> Create Group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 🗂️ Navigation Structure: Unified & Context-Aware

### Core Principle: **Same Structure, Different Content**

**Individual Context:**

- Shows user's own entities
- Personal actions
- Individual-focused features

**Group Context:**

- Shows group's entities
- Group actions
- Group-focused features

### Navigation Sections (Both Contexts)

```
┌─────────────────────────────────┐
│  CONTEXT SWITCHER               │
├─────────────────────────────────┤
│  📊 Overview                     │
│    • Dashboard                   │
│    • Activity                    │
│    • Analytics                   │
├─────────────────────────────────┤
│  💼 Business                     │
│    • Products                    │
│    • Services                    │
│    • Projects                    │
│    • Causes                      │
├─────────────────────────────────┤
│  🏘️ Community                    │
│    • Members                     │
│    • Events                      │
│    • Proposals                   │
│    • Voting                      │
├─────────────────────────────────┤
│  💰 Finance                      │
│    • Treasury                    │
│    • Assets                      │
│    • Loans                       │
├─────────────────────────────────┤
│  ⚙️ Settings                     │
│    • Profile/Group Settings      │
│    • Permissions                 │
│    • Integrations                │
└─────────────────────────────────┘
```

---

## 📋 Detailed Navigation Structure

### Individual Context Navigation

```typescript
const individualNavigation: NavSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: Home },
      { name: 'Timeline', href: '/timeline', icon: BookOpen },
      { name: 'Messages', href: '/messages', icon: MessageSquare },
      { name: 'Profile', href: '/dashboard/info', icon: User },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    items: [
      { name: 'Products', href: '/dashboard/store', icon: Package },
      { name: 'Services', href: '/dashboard/services', icon: Briefcase },
      { name: 'Projects', href: '/dashboard/projects', icon: Rocket },
      { name: 'Causes', href: '/dashboard/causes', icon: Heart },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    items: [
      { name: 'Groups', href: '/groups', icon: Users },
      { name: 'People', href: '/dashboard/people', icon: Users },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { name: 'Wallets', href: '/dashboard/wallets', icon: Wallet },
      { name: 'Assets', href: '/assets', icon: Building },
      { name: 'Loans', href: '/loans', icon: Banknote },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    items: [{ name: 'Profile Settings', href: '/settings', icon: Settings }],
  },
];
```

### Group Context Navigation

```typescript
const groupNavigation: NavSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    items: [
      { name: 'Dashboard', href: '/groups/[slug]', icon: Home },
      { name: 'Activity', href: '/groups/[slug]/activity', icon: Activity },
      { name: 'Analytics', href: '/groups/[slug]/analytics', icon: BarChart },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    items: [
      { name: 'Products', href: '/groups/[slug]/products', icon: Package },
      { name: 'Services', href: '/groups/[slug]/services', icon: Briefcase },
      { name: 'Projects', href: '/groups/[slug]/projects', icon: Rocket },
      { name: 'Causes', href: '/groups/[slug]/causes', icon: Heart },
    ],
  },
  {
    id: 'community',
    title: 'Community',
    items: [
      { name: 'Members', href: '/groups/[slug]/members', icon: Users },
      { name: 'Events', href: '/groups/[slug]/events', icon: Calendar },
      { name: 'Proposals', href: '/groups/[slug]/proposals', icon: FileText },
      { name: 'Voting', href: '/groups/[slug]/voting', icon: Vote },
      { name: 'Invitations', href: '/groups/[slug]/invitations', icon: Mail },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    items: [
      { name: 'Treasury', href: '/groups/[slug]/treasury', icon: Wallet },
      { name: 'Assets', href: '/groups/[slug]/assets', icon: Building },
      { name: 'Loans', href: '/groups/[slug]/loans', icon: Banknote },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    items: [
      { name: 'Group Settings', href: '/groups/[slug]/settings', icon: Settings },
      { name: 'Permissions', href: '/groups/[slug]/permissions', icon: Shield },
    ],
  },
];
```

---

## 🎨 Visual Design: Context Indication

### 1. Sidebar Header

**Individual Context:**

```
┌─────────────────────────────────┐
│  👤 You                         │
│  Your Personal Dashboard        │
└─────────────────────────────────┘
```

**Group Context:**

```
┌─────────────────────────────────┐
│  🏢 Zurich Bar Collective       │
│  Community • 12 members         │
│  You: Admin                     │
└─────────────────────────────────┘
```

### 2. Breadcrumb/Header Indication

**Individual:**

```
Dashboard > Products
```

**Group:**

```
Zurich Bar Collective > Products
```

### 3. Color Coding

- **Individual:** Blue theme
- **Group:** Purple theme (or group's color)

---

## 🔄 Context Switching Flow

### User Journey: Individual → Group

```
1. User on /dashboard (Individual context)
   ↓
2. Clicks context switcher
   ↓
3. Sees list of groups
   ↓
4. Selects "Zurich Bar Collective"
   ↓
5. Sidebar updates to group navigation
   ↓
6. URL changes to /groups/zurich-bar-collective
   ↓
7. Content shows group's data
```

### User Journey: Group → Individual

```
1. User on /groups/zurich-bar-collective (Group context)
   ↓
2. Clicks context switcher
   ↓
3. Selects "You" (Individual)
   ↓
4. Sidebar updates to individual navigation
   ↓
5. URL changes to /dashboard
   ↓
6. Content shows user's data
```

---

## 🏗️ Implementation Architecture

### 1. Navigation Context Hook

```typescript
// Sketch. Real hook: src/hooks/useNavigationContext.ts
export function useNavigationContext() {
  const pathname = usePathname();
  const [context, setContext] = useState<NavigationContextData>({
    type: 'individual',
    id: userId,
    name: 'You',
  });

  // Detect context from URL
  useEffect(() => {
    if (pathname.startsWith('/groups/')) {
      const slug = pathname.split('/groups/')[1]?.split('/')[0];
      if (slug) {
        // Load group context
        loadGroupContext(slug);
      }
    } else {
      // Individual context
      setContext({
        type: 'individual',
        id: userId,
        name: 'You',
      });
    }
  }, [pathname]);

  const switchContext = (type: NavigationContext, id?: string) => {
    if (type === 'individual') {
      router.push('/dashboard');
    } else if (type === 'group' && id) {
      router.push(`/groups/${id}`);
    }
  };

  return { context, switchContext };
}
```

### 2. Adaptive Sidebar Component

```typescript
// Sketch only. Not built; the sidebar is src/components/sidebar/Sidebar.tsx
export function AdaptiveSidebar() {
  const { context } = useNavigationContext();
  const navigation = context.type === 'individual'
    ? individualNavigation
    : groupNavigation;

  return (
    <Sidebar>
      <ContextSwitcher />
      <SidebarNavigation
        sections={navigation}
        context={context}
      />
    </Sidebar>
  );
}
```

### 3. Route Structure

**Individual Routes:**

```
/dashboard
/dashboard/store
/dashboard/services
/assets
/loans
```

**Group Routes:**

```
/groups/[slug]
/groups/[slug]/products
/groups/[slug]/services
/groups/[slug]/assets
/groups/[slug]/loans
/groups/[slug]/members
/groups/[slug]/events
/groups/[slug]/proposals
/groups/[slug]/treasury
```

---

## 🎯 Entity Management: Unified Pattern

### Core Principle: **Same Entity, Different Owner**

**All entities can be:**

- Owned by individual (`actor_id` = user's actor)
- Owned by group (`actor_id` = group's actor)

**Navigation adapts:**

- Individual context → Shows user's entities
- Group context → Shows group's entities

### Entity List Pages

**Individual:**

```
/dashboard/store          → User's products
/dashboard/services       → User's services
/assets                   → User's assets
```

**Group:**

```
/groups/[slug]/products   → Group's products
/groups/[slug]/services   → Group's services
/groups/[slug]/assets     → Group's assets
```

**Same component, different data source:**

```typescript
// src/app/(authenticated)/dashboard/store/page.tsx
export default function ProductsPage() {
  const { context } = useNavigationContext();
  const actorId = context.type === 'individual'
    ? userActorId
    : groupActorId;

  const { products } = useProducts({ actor_id: actorId });

  return <ProductsList products={products} context={context} />;
}
```

---

## 📱 Mobile Navigation

### Bottom Tab Bar (Mobile)

**Individual Context:**

```
[Home] [Sell] [Raise] [Network] [You]
```

**Group Context:**

```
[Home] [Business] [Community] [Finance] [Settings]
```

**Context Switcher:**

- Top of screen (header)
- Dropdown menu
- Shows current context

---

## 🎨 Visual Hierarchy

### 1. Context Switcher Prominence

**Desktop:**

- Top of sidebar
- Always visible
- Clear visual distinction

**Mobile:**

- Header
- Sticky top
- Dropdown on tap

### 2. Active Context Indication

- **Bold text** for active context
- **Icon** changes (User vs Building)
- **Color** changes (Blue vs Purple)
- **Badge** for role (if group member)

### 3. Navigation Item States

- **Active:** Current page (highlighted)
- **Available:** Clickable
- **Disabled:** Grayed out (no permission)
- **New:** Badge indicator (e.g., "3 new proposals")

---

## 🔐 Permission-Based Navigation

### Hide/Show Based on Permissions

**Individual:**

- All items visible (user owns everything)

**Group:**

- Show only items user has permission for
- Gray out items user can view but not edit
- Hide items user has no access to

```typescript
// Filter navigation based on permissions
const filteredNavigation = navigation.map(section => ({
  ...section,
  items: section.items.filter(item => {
    if (context.type === 'group') {
      return hasPermission(context.id, item.permission);
    }
    return true; // Individual: all visible
  }),
}));
```

---

## 🚀 Progressive Enhancement

### Phase 1: Basic Context Switching (MVP)

- Context switcher in sidebar
- Basic navigation adaptation
- URL-based context detection

### Phase 2: Enhanced UX

- Keyboard shortcuts (Cmd+K for context switch)
- Recent contexts (quick switch)
- Context-specific search

### Phase 3: Advanced Features

- Multi-context view (compare individual vs group)
- Context bookmarks
- Context-specific notifications

---

## 📊 Information Architecture

### Entity Organization

**By Category:**

- Business (Products, Services, Projects, Causes)
- Community (Members, Events, Proposals, Voting)
- Finance (Treasury, Assets, Loans)

**By Action:**

- Create (all entity types)
- Manage (existing entities)
- Analyze (analytics, reports)

**By Permission:**

- View (read-only)
- Edit (can modify)
- Admin (full control)

---

## ✅ Benefits of This Design

1. **Clear Context Indication**
   - Always know if you're in individual or group context
   - Visual distinction (icon, color, name)

2. **Unified Navigation**
   - Same structure, different content
   - Easy to learn, consistent UX

3. **Scalable**
   - Easy to add new entities
   - Easy to add new contexts (future: projects, companies)

4. **Permission-Aware**
   - Shows only what user can access
   - Clear indication of permissions

5. **Mobile-Friendly**
   - Context switcher in header
   - Bottom tab bar adapts to context

6. **Follows Best Practices**
   - GitHub-style context switching
   - Slack-style workspace switching
   - Notion-style page switching

---

## 🎯 Implementation Checklist

### Phase 1: Foundation

- [x] Create `NavigationContext` type and hook (`src/hooks/useNavigationContext.ts`)
- [x] Create `ContextSwitcher` component (`src/components/sidebar/ContextSwitcher.tsx`)
- [ ] Update `Sidebar` to be adaptive
- [x] Create individual navigation config (`src/config/navigation.ts`)
- [ ] Create group navigation config

### Phase 2: Routing

- [ ] Update routes to support context
- [ ] Add group-specific routes
- [ ] Update breadcrumbs to show context

### Phase 3: Entity Pages

- [ ] Make entity list pages context-aware
- [ ] Update entity creation to support context
- [ ] Add permission checks

### Phase 4: Polish

- [ ] Add visual indicators
- [ ] Add keyboard shortcuts
- [ ] Add context-specific search
- [ ] Mobile optimization

---

## 📝 Summary

**Solution: Context Switcher + Adaptive Sidebar**

- **One sidebar** that adapts to context
- **Context switcher** at top (always visible)
- **Clear visual indication** of current context
- **Unified structure** across contexts
- **Permission-aware** navigation
- **Scalable** and extensible

**Follows best practices from:**

- GitHub (context switching)
- Slack (workspace switching)
- Notion (page switching)
- Linear (team switching)

**Benefits:**

- ✅ Clear context indication
- ✅ No navigation bloat
- ✅ Easy to understand
- ✅ Scalable architecture
- ✅ Mobile-friendly

---

**Last Updated:** 2025-12-30 (status note added 2026-10-19)
