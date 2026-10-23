# Frontend & UI/UX Best Practices

**Purpose**: Design system compliance and UX patterns for OrangeCat

**Last Updated**: 2026-10-19

---

## Design System (ALWAYS Follow)

### Colors

**Use design tokens, NEVER hex codes directly.** Every colour is a CSS custom
property in `src/app/globals.css` (the token SSOT); `tailwind.config.ts` only
maps utility classes onto those vars. See the "Design System" section of the
root `CLAUDE.md` for the migration direction.

```tsx
// ❌ Wrong - hardcoded colors
<div className="bg-[#f7931a]">

// ✅ Correct - semantic tokens
<div className="bg-accent-warm text-on-accent">
```

#### Color Palette

**Semantic tier (use in new code)**:

- Text: `text-fg-primary` / `text-fg-secondary` / `text-fg-tertiary` / `text-fg-muted` / `text-fg-inverted`
- Surfaces: `bg-surface-page` / `bg-surface-base` / `bg-surface-raised` / `bg-surface-overlay` (also `-modal`, `-drawer`, `-public`)
- Accent: `bg-accent-warm` (`--accent-primary` → `--bitcoin-orange`, `#f7931a`), hover `bg-accent-warm-hover`;
  text on it is `text-on-accent` (`text-white` on the accent fails AA)
  - Top-of-funnel conversion only (the `accent` Button variant). In-app actions are `primary`.
- Status: `bg-status-positive` / `-warning` / `-negative` / `-neutral` (+ `-subtle`) — only for actual status

**One orange**: the accent and Bitcoin orange are the same colour (root `CLAUDE.md` → "One orange").
`bg-bitcoinOrange` / `text-bitcoinOrange` say _Bitcoin_ (balances, Lightning, icons);
`bg-accent-warm` says _the action that brings someone in_. Nothing else is orange.
There is no `bitcoin-orange` utility class — `text-bitcoin-orange` renders nothing.

**Legacy tier (still in use, migrate as touched)**:

- shadcn-style HSL tokens: `bg-card`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `border-border`
- Brand palette `tiffany-{50..900}` (`bg-tiffany` = `tiffany-500` = `#0ABAB5`, plus
  `bg-tiffany-light` / `bg-tiffany-dark`) and `orange-{50..900}` (no `bg-orange`
  DEFAULT). Being dropped from new code — do not add new uses.

---

### Typography

**Font families** (self-hosted in `src/fonts/`, wired in `src/app/layout.tsx`):

- `font-sans` — Inter (body, the default)
- `font-heading` — Space Grotesk (display / headings)
- `font-mono` — IBM Plex Mono (code)

**Font Sizes** (`tailwind.config.ts` → `fontSize`):

```tsx
<h1 className="text-4xl">36px hero</h1>
<h2 className="text-3xl">30px heading</h2>
<h3 className="text-2xl">24px heading</h3>
<p className="text-base">16px body</p>
<small className="text-sm">14px small</small>
```

**Never inline font sizes**:

```tsx
// ❌ Wrong
<p style={{ fontSize: '16px' }}>

// ✅ Correct
<p className="text-base">
```

---

### Two global rules that quietly fight your classes

Both live in `src/app/globals.css` and both cost an afternoon to find. Read
them before you wonder why a screen "looks loose" or a size "does nothing".

- **Every `<p>` has `margin-bottom: 0.75rem`** (1rem from `sm:`). A stack of
  paragraphs — a name over a handle over a sentence — comes out with 12px gaps
  nobody asked for, and a list looks like a form. In any stacked group, give the
  paragraphs `mb-0` (or use `<span className="block">`) and let the parent set
  the rhythm with `gap-*` / `space-y-*`.
- **Every text `<input>` is pinned to `font-size: 16px !important`**, so iOS
  does not zoom on focus. A `text-3xl` on an input is silently ignored — and no
  utility class can win, because an important rule in an earlier cascade layer
  beats an important rule in a later one. iOS only zooms text _smaller_ than
  16px, so a larger input is safe: add the `oc-figure-input` class, the one
  exemption written into the rule (the amount field uses it).

Verify layout the way the owner sees it: at 390px, in light and dark, in a
real browser. Reading the classes finds neither of the above.

### Spacing

**Use Tailwind spacing scale (4px base)**:

```tsx
// Padding
<div className="p-1">  {/* 4px */}
<div className="p-2">  {/* 8px */}
<div className="p-4">  {/* 16px */}
<div className="p-6">  {/* 24px */}
<div className="p-8">  {/* 32px */}

// Margin
<div className="m-4">  {/* 16px */}

// Gap
<div className="gap-4">  {/* 16px between children */}
```

**Consistency Rule**: Same spacing for similar elements

```tsx
// ✅ Consistent
<Card className="p-6">  {/* All cards use p-6 */}
<Card className="p-6">
<Card className="p-6">

// ❌ Inconsistent
<Card className="p-4">
<Card className="p-6">
<Card className="p-8">
```

---

### Components

#### Buttons

```tsx
import Button from '@/components/ui/Button';

// Primary CTA (the default variant)
<Button variant="primary">Create Product</Button>

// Top-of-funnel conversion CTA (warm accent)
<Button variant="accent">Get started</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive action
<Button variant="danger">Delete</Button>

// Ghost (subtle)
<Button variant="ghost">View Details</Button>

// Sizes
<Button size="xl">Extra large</Button>
<Button size="lg">Large</Button>
<Button size="md">Default</Button>
<Button size="sm">Small</Button>
```

#### Cards

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';

<Card className="p-6">
  <CardHeader>
    <CardTitle>Product Title</CardTitle>
  </CardHeader>
  <CardContent>{/* Main content */}</CardContent>
  <CardFooter>{/* Actions */}</CardFooter>
</Card>;
```

#### Forms

```tsx
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import Input from '@/components/ui/Input';

<Form {...form}>
  <FormField
    control={form.control}
    name="title"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Title</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormMessage /> {/* Error message */}
      </FormItem>
    )}
  />
</Form>;
```

---

## UX Principles

### 1. Progressive Disclosure

**Rule**: Show only what user needs NOW, hide complexity until needed.

**Pattern**:

```
Simple → Medium → Complex → Expert
  ↓        ↓         ↓        ↓
Template  Form    Advanced  Full Control
```

**Implementation**:

```tsx
// ✅ Good: Progressive disclosure
<div>
  {/* Step 1: Simple */}
  <TemplateSelector />

  {templateSelected && (
    /* Step 2: Medium */
    <BasicFields />
  )}

  {basicComplete && (
    /* Step 3: Complex (collapsible) */
    <Collapsible>
      <CollapsibleTrigger>Advanced Options</CollapsibleTrigger>
      <CollapsibleContent>
        <AdvancedFields />
      </CollapsibleContent>
    </Collapsible>
  )}
</div>

// ❌ Bad: Everything at once
<div>
  <AllFieldsAtOnce />  {/* Overwhelming! */}
</div>
```

**Examples in OrangeCat**:

- Entity creation: Templates → Form → Advanced options
- Settings: Basic → Advanced → Expert
- Filters: Common → All filters

---

### 2. Context-Aware Navigation

**Rule**: Navigation adapts to user's current context (individual vs group).

```tsx
// ✅ Adaptive navigation
const { context } = useNavigationContext();

const navigation = context.type === 'individual' ? individualNavigation : groupNavigation;

return <Sidebar items={navigation} />;
```

**Visual Indicators**:

- **Individual**: 👤 icon, Blue theme
- **Group**: 🏢 icon, Purple theme
- **Always show** current context in header/sidebar

**Context Switcher** (always visible):

```tsx
<ContextSwitcher>
  <ContextSwitcherTrigger>
    {context.type === 'individual' ? (
      <>
        <User /> You
      </>
    ) : (
      <>
        <Building2 /> {context.name}
      </>
    )}
  </ContextSwitcherTrigger>
  <ContextSwitcherContent>{/* List of contexts */}</ContextSwitcherContent>
</ContextSwitcher>
```

---

### 3. Visual Hierarchy

**Rules**:

1. **One primary CTA per page**
2. **Size indicates importance**
3. **Color draws attention** (use sparingly)
4. **White space creates clarity**

**Example**:

```tsx
// ✅ Good hierarchy
<div className="space-y-6">
  {/* Size: Largest → Most important */}
  <h1 className="text-3xl font-bold">Page Title</h1>

  {/* Color: Muted → Less important */}
  <p className="text-base text-muted-foreground">Description text</p>

  {/* Size + Color: Primary action */}
  <Button size="lg" variant="primary">
    Primary Action
  </Button>

  {/* Smaller, subtle: Secondary action */}
  <Button size="sm" variant="ghost">
    Secondary
  </Button>
</div>
```

---

### 4. Error States

**Always provide**:

- Clear error message
- Suggested action
- Recovery path

```tsx
import { Alert, AlertDescription } from '@/components/ui/Alert';
import { AlertCircle } from 'lucide-react';

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <p className="font-semibold">Error</p>
  <AlertDescription>
    Failed to create product. Check your connection and try again.
  </AlertDescription>
  <div className="mt-4">
    <Button onClick={retry} size="sm">
      Retry
    </Button>
  </div>
</Alert>;
```

**Form Validation Errors**:

```tsx
// ✅ Inline errors below field
<FormField
  name="title"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Title</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage /> {/* Error appears here */}
    </FormItem>
  )}
/>
```

---

### 5. Loading States

**Always show loading feedback**:

```tsx
// ✅ Skeleton loading
import { Skeleton } from '@/components/ui/Skeleton';

{isLoading ? (
  <Skeleton className="h-24 w-full" />
) : (
  <Content data={data} />
)}

// ✅ Spinner for actions
<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  Submit
</Button>

// ✅ Suspense boundaries
<Suspense fallback={<Skeleton />}>
  <AsyncComponent />
</Suspense>
```

---

### 6. Empty States

**Always provide**:

- Explanatory icon
- Friendly message
- Primary action

```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
  <h3 className="text-lg font-semibold mb-2">No products yet</h3>
  <p className="text-muted-foreground mb-6">Create your first product to get started</p>
  <Button onClick={onCreate}>
    <Plus className="mr-2 h-4 w-4" />
    Create Product
  </Button>
</div>
```

---

## Mobile-First Design

### Touch Targets

**Minimum**: 44x44px (11 Tailwind units)

```tsx
// ✅ Touch-friendly
<Button className="min-h-11 min-w-11">
  <Icon />
</Button>

// ❌ Too small for touch
<button className="p-1">  {/* Only 4px = too small! */}
```

### Responsive Patterns

```tsx
// Stack on mobile, side-by-side on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div>Column 1</div>
  <div>Column 2</div>
</div>

// Hide on mobile, show on desktop
<div className="hidden md:block">
  Desktop only content
</div>

// Show on mobile, hide on desktop
<div className="block md:hidden">
  Mobile only content
</div>
```

### Mobile Navigation

**Bottom tab bar on mobile**:

```tsx
// Mobile: Fixed bottom navigation
<nav className="md:hidden fixed bottom-0 left-0 right-0">
  <TabBar items={mobileNavItems} />
</nav>

// Desktop: Sidebar
<aside className="hidden md:block">
  <Sidebar items={desktopNavItems} />
</aside>
```

---

## Accessibility

### Keyboard Navigation

```tsx
// ✅ Support Enter key
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  tabIndex={0}
>
  Action
</button>

// ✅ Focus management
<Dialog>
  <DialogContent>
    <DialogTitle>Modal Title</DialogTitle>
    {/* Focus trapped inside modal */}
  </DialogContent>
</Dialog>
```

### Focus States

```tsx
// ✅ Visible focus rings
<Button className="focus-visible:ring-2 focus-visible:ring-tiffany focus-visible:ring-offset-2">
  Accessible Button
</Button>

// ✅ Skip to main content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Alt Text

```tsx
// ✅ Descriptive alt text
<Image
  src="/product.jpg"
  alt="Organic coffee beans in burlap sack"
  width={400}
  height={300}
/>

// ❌ Generic alt text
<Image alt="Image" />  {/* Not helpful! */}
```

### ARIA Labels

```tsx
// ✅ ARIA for icon buttons
<button aria-label="Close dialog">
  <X className="h-4 w-4" />
</button>

// ✅ ARIA for form sections
<section aria-labelledby="product-details">
  <h2 id="product-details">Product Details</h2>
  {/* Content */}
</section>
```

---

## Performance

### Code Splitting

```tsx
// ✅ Lazy load heavy components
import dynamic from 'next/dynamic';

const HeavyChart = dynamic(() => import('./HeavyChart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false, // Client-side only if needed
});
```

### Image Optimization

```tsx
// ✅ Always use Next.js Image
import Image from 'next/image';

<Image
  src="/product.jpg"
  width={800}
  height={600}
  alt="Product description"
  priority={aboveFold}  // For above-the-fold images
  placeholder="blur"    // Blur-up effect
  blurDataURL="..."
/>

// ❌ Don't use <img>
<img src="/product.jpg" />  {/* Missing optimizations! */}
```

### React Optimization

```tsx
// ✅ Memo for expensive renders
const ExpensiveComponent = React.memo(Component);

// ✅ useMemo for expensive calculations
const sortedProducts = useMemo(
  () => products.sort((a, b) => a.price_btc - b.price_btc),
  [products]
);

// ✅ useCallback for stable references
const handleClick = useCallback(() => {
  performAction(id);
}, [id]);
```

---

## Component Patterns

### Atomic Design

```
atoms/      → Button, Input, Label
molecules/  → FormField, SearchBox, ProductPrice
organisms/  → EntityForm, NavigationBar, ProductCard
templates/  → DashboardLayout, EntityLayout
pages/      → ProductsPage, DashboardPage
```

### Naming Conventions

- **Components**: `PascalCase` (e.g., `EntityCard.tsx`)
- **Files**: Match component name
- **Props**: `camelCase` (e.g., `entityType`)
- **CSS classes**: Tailwind utility classes only

### Component Structure

```tsx
// ✅ Good structure
interface ProductCardProps {
  product: Product;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ProductCard({ product, onEdit, onDelete }: ProductCardProps) {
  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>{product.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{product.description}</p>
        <p className="text-lg font-semibold mt-4">{formatAmount(product.price_btc)}</p>
      </CardContent>
      {(onEdit || onDelete) && (
        <CardFooter className="flex gap-2">
          {onEdit && (
            <Button variant="outline" onClick={onEdit}>
              Edit
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
```

---

## Form Best Practices

### React Hook Form + Zod

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const form = useForm<FormData>({
  resolver: zodResolver(schema),
  defaultValues: {
    title: '',
    price_btc: 0,
  },
});

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormDescription>Choose a clear, descriptive title</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit" disabled={form.formState.isSubmitting}>
      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Submit
    </Button>
  </form>
</Form>;
```

### Validation Feedback

- **Inline errors**: Below each field
- **Submit errors**: At top of form
- **Success message**: With action confirmation

```tsx
// ✅ Success feedback
{
  submitSuccess && (
    <Alert>
      <CheckCircle className="h-4 w-4" />
      <AlertTitle>Success!</AlertTitle>
      <AlertDescription>
        Product created successfully.
        <Link href={productUrl} className="underline ml-2">
          View product
        </Link>
      </AlertDescription>
    </Alert>
  );
}
```

---

## Testing with Browser Automation

### After UI Changes

```javascript
// 1. Navigate to page
(await mcp_cursor) -
  ide -
  browser_browser_navigate({
    url: 'http://localhost:3020/dashboard/store/create',
  });

// 2. Snapshot to verify layout
const snapshot = (await mcp_cursor) - ide - browser_browser_snapshot();

// 3. Test interaction
(await mcp_cursor) -
  ide -
  browser_browser_type({
    element: 'Title input',
    ref: 'input[name="title"]',
    text: 'Test Product',
  });

// 4. Verify visual feedback
(await mcp_cursor) - ide - browser_browser_snapshot();

// 5. Submit and verify
(await mcp_cursor) -
  ide -
  browser_browser_click({
    element: 'Submit button',
    ref: 'button[type="submit"]',
  });

(await mcp_cursor) -
  ide -
  browser_browser_wait_for({
    text: 'Product created successfully',
  });
```

---

## References

- **Design System**: `docs/design-system/README.md`
- **Navigation UX**: `docs/design-system/NAVIGATION_UX_DESIGN.md`
- **Modularity Philosophy**: `docs/architecture/MODULARITY_PHILOSOPHY.md`
- **Tailwind Config**: `tailwind.config.ts`
- **shadcn/ui Components**: `src/components/ui/`

---

**Remember**: Consistency creates confidence. Users learn patterns once and apply them everywhere.
