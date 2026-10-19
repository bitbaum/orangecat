# Entity List System Architecture

**Created:** 2025-01-27  
**Last Modified:** 2025-01-27  
**Last Modified Summary:** Initial documentation of modular entity list system

## Overview

The Entity List System is a modular, reusable architecture for displaying lists of entities (services, products, etc.) across the application. It follows DRY principles, separation of concerns, and provides a single source of truth for entity rendering.

## Architecture Principles

1. **Modularity**: Components are reusable across different entity types
2. **DRY**: Data fetching logic is centralized in a hook
3. **Type Safety**: Full TypeScript support with generics
4. **Separation of Concerns**: Display, data fetching, and configuration are separated
5. **Single Source of Truth**: Entity configurations define how entities are rendered

## Components

### EntityCard

**Location:** `src/components/entity/EntityCard.tsx`

A flexible, responsive card component for displaying individual entities.

**Features:**

- Responsive design (mobile-first)
- Image with proper aspect ratio handling
- Status badges with variants
- Flexible action buttons
- Hover states and transitions
- Accessible (ARIA labels, keyboard navigation)
- Support for edit button overlay

**Props:**

```typescript
interface EntityCardProps {
  id: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  href: string;
  badge?: string;
  badgeVariant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  priceLabel?: string;
  metadata?: ReactNode;
  actions?: ReactNode;
  className?: string;
  onClick?: () => void;
  imageAspectRatio?: 'square' | 'landscape' | 'portrait';
  showEditButton?: boolean;
  editHref?: string;
}
```

### EntityList

**Location:** `src/components/entity/EntityList.tsx`

A grid-based list component that renders multiple EntityCards with loading and empty states.

**Features:**

- Responsive grid (configurable columns for mobile/tablet/desktop)
- Skeleton loading states
- Empty state handling
- Type-safe with generics

**Props:**

```typescript
interface EntityListProps<T extends EntityItem> {
  items: T[];
  isLoading?: boolean;
  makeHref: (item: T) => string;
  makeCardProps: (
    item: T
  ) => Omit<EntityCardProps, 'id' | 'title' | 'description' | 'thumbnailUrl' | 'href'>;
  emptyState?: { title: string; description?: string; action?: ReactNode };
  className?: string;
  gridCols?: { mobile?: number; tablet?: number; desktop?: number };
  skeletonCount?: number;
}
```

## Hooks

### useEntityList

**Location:** `src/hooks/useEntityList.ts`

A reusable hook for fetching and managing entity lists with pagination.

**Features:**

- Automatic pagination
- Loading and error states
- Type-safe
- Configurable API endpoint and query parameters

**Usage:**

```typescript
const { items, loading, error, page, total, setPage, refresh } = useEntityList<EntityType>({
  apiEndpoint: '/api/entities',
  userId: user?.id,
  limit: 12,
  enabled: !!user?.id,
});
```

## Configuration

### Entity Config

**Location:** `src/config/entities/`

Entity configurations define how entities are rendered. Each entity type has its own configuration file.

**Example:** `src/config/entities/services.tsx`

```typescript
export const serviceEntityConfig: EntityConfig<UserService> = {
  name: 'Service',
  namePlural: 'Services',
  colorTheme: 'orange',
  listPath: '/dashboard/services',
  detailPath: (id) => `/dashboard/services/${id}`,
  createPath: '/dashboard/services/create',
  editPath: (id) => `/dashboard/services/create?edit=${id}`,
  apiEndpoint: '/api/services',
  makeHref: (service) => `/dashboard/services/${service.id}`,
  makeCardProps: (service) => ({
    priceLabel: `${service.hourly_rate_sats} sats/hour`,
    badge: service.status === 'published' ? 'Published' : 'Draft',
    // ... other props
  }),
  emptyState: {
    title: 'No services yet',
    description: 'Start offering your expertise...',
    action: <Button>Add Service</Button>,
  },
  gridCols: { mobile: 1, tablet: 2, desktop: 3 },
};
```

## Usage Example

### Services Page

```typescript
export default function ServicesDashboardPage() {
  const { user, isLoading, hydrated } = useAuth();

  const {
    items: services,
    loading,
    error,
    page,
    total,
    setPage,
  } = useEntityList<UserService>({
    apiEndpoint: serviceEntityConfig.apiEndpoint,
    userId: user?.id,
    limit: 12,
    enabled: !!user?.id && hydrated && !isLoading,
  });

  return (
    <EntityListShell
      title="My Services"
      description="Offer your expertise..."
      headerActions={<Button>Add Service</Button>}
    >
      <EntityList
        items={services}
        isLoading={loading}
        makeHref={serviceEntityConfig.makeHref}
        makeCardProps={serviceEntityConfig.makeCardProps}
        emptyState={serviceEntityConfig.emptyState}
        gridCols={serviceEntityConfig.gridCols}
      />
      <CommercePagination
        page={page}
        limit={12}
        total={total}
        onPageChange={setPage}
      />
    </EntityListShell>
  );
}
```

## Benefits

1. **Code Reusability**: Same components work for services, products, and future entity types
2. **Consistency**: All entity lists have the same look and feel
3. **Maintainability**: Changes to card design affect all entities
4. **Type Safety**: TypeScript ensures correct usage
5. **Performance**: Optimized image loading, skeleton states, and efficient rendering
6. **Accessibility**: Built-in ARIA labels and keyboard navigation

## Adding a New Entity Type

1. Create entity configuration in `src/config/entities/<entity-name>.tsx`
2. Use `useEntityList` hook in your page component
3. Render with `EntityList` component
4. That's it! The system handles the rest.

## Design Improvements

### UI/UX Enhancements

1. **Better Image Handling**
   - Proper aspect ratios (square, landscape, portrait)
   - Next.js Image optimization
   - Graceful fallback for missing images
   - Hover scale effect

2. **Responsive Design**
   - Mobile-first approach
   - 1 column on mobile, 2 on tablet, 3+ on desktop
   - Touch-friendly targets (44px minimum)
   - Proper spacing and padding

3. **Visual Hierarchy**
   - Clear typography scale
   - Status badges prominently displayed
   - Price information clearly visible
   - Metadata (category, location) shown appropriately

4. **Interactions**
   - Smooth hover transitions
   - Edit button overlay on hover
   - Focus states for accessibility
   - Loading skeletons for better perceived performance

5. **Empty States**
   - Helpful messaging
   - Clear call-to-action
   - Consistent design

## Performance Considerations

1. **Image Optimization**: Next.js Image component handles optimization automatically
2. **Skeleton Loading**: Shows structure while loading, improving perceived performance
3. **Lazy Loading**: Images load as needed
4. **Efficient Rendering**: React memoization where appropriate
5. **Pagination**: Only loads visible items

## Future Enhancements

- [ ] Filtering and sorting
- [ ] Bulk actions
- [ ] Drag-and-drop reordering
- [ ] List/Grid view toggle
- [ ] Advanced search
- [ ] Export functionality
