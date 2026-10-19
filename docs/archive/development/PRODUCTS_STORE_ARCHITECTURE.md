# Products/Store Architecture: Unified Model

**Created:** 2025-12-30  
**Purpose:** Clarify that products are unified - one product can be associated with individual, group, or both. Only the VIEW changes.

---

## 🎯 Core Principle

**One Product, Multiple Views:**
- Products are NOT separate for individuals vs groups
- One product can be associated with:
  - Individual only (`actor_id` = user's actor)
  - Group only (`actor_id` = group's actor)
  - Both (via multiple associations - future enhancement)
- The VIEW of the store changes based on context, but products are shared

---

## 📐 Current Architecture

### Database Schema

```sql
CREATE TABLE user_products (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),  -- Creator
  actor_id uuid REFERENCES actors(id),     -- Owner (user OR group actor)
  title text NOT NULL,
  description text,
  price_sats bigint NOT NULL,
  -- ... other fields
);
```

**Key Points:**
- `user_id` = Creator (who created it)
- `actor_id` = Owner (individual OR group)
- Products can be owned by groups via `actor_id`

### Current Routes

**Individual View:**
- `/dashboard/store` → Shows products where `actor_id` = user's actor

**Group View (Future):**
- `/groups/[slug]/store` → Shows products where `actor_id` = group's actor

**Same products table, different filter!**

---

## 🎨 Navigation Design (Updated)

### Individual Context

```
📊 Overview
  • Dashboard
  • Timeline
  • Messages
  • Profile

💼 Business
  • Store          ← Shows YOUR products
  • Services       ← Shows YOUR services
  • Projects       ← Shows YOUR projects
  • Causes         ← Shows YOUR causes
```

### Group Context

```
📊 Overview
  • Dashboard
  • Activity
  • Analytics

💼 Business
  • Store          ← Shows GROUP'S products (same products, different filter)
  • Services       ← Shows GROUP'S services
  • Projects       ← Shows GROUP'S projects
  • Causes         ← Shows GROUP'S causes
```

**Key:** Same entity types, same routes structure, different data source (filtered by `actor_id`)

---

## 🔄 Product Association Flow

### Scenario 1: Individual Creates Product

```
1. User creates product
   ↓
2. Product created with:
   - user_id: user.id (creator)
   - actor_id: user's actor (owner)
   ↓
3. Product appears in:
   - /dashboard/store (individual view)
   - NOT in group stores (yet)
```

### Scenario 2: Individual Associates Product with Group

```
1. User has product (actor_id = user's actor)
   ↓
2. User goes to product page
   ↓
3. Clicks "Associate with Group"
   ↓
4. Selects group
   ↓
5. If group is hierarchical:
   - Direct association (actor_id updated to group's actor)
   ↓
6. If group is democratic:
   - Proposal created
   - Group votes
   - If passes: actor_id updated to group's actor
   ↓
7. Product now appears in:
   - /groups/[slug]/store (group view)
   - Removed from /dashboard/store (individual view)
```

### Scenario 3: Group Creates Product

```
1. Group member creates product
   ↓
2. Product created with:
   - user_id: member.id (creator)
   - actor_id: group's actor (owner)
   ↓
3. Product appears in:
   - /groups/[slug]/store (group view)
   - NOT in individual stores
```

---

## 🏗️ Implementation: Unified Store Component

### Store List Component (Context-Aware)

```typescript
// src/components/store/StoreList.tsx
export function StoreList() {
  const { context } = useNavigationContext();
  
  // Get actor_id based on context
  const actorId = context.type === 'individual'
    ? userActorId
    : groupActorId;

  // Query products for this actor
  const { products } = useProducts({ actor_id: actorId });

  return (
    <div>
      <h1>
        {context.type === 'individual' 
          ? 'Your Store' 
          : `${context.name}'s Store`}
      </h1>
      <ProductsGrid products={products} />
    </div>
  );
}
```

**Key Points:**
- ✅ Same component for both contexts
- ✅ Different data source (filtered by `actor_id`)
- ✅ Different title/header based on context

### Store Routes

**Individual:**
```
/dashboard/store          → StoreList (context: individual)
/dashboard/store/create   → CreateProduct (context: individual)
/dashboard/store/[id]     → ProductDetail (context: individual)
```

**Group:**
```
/groups/[slug]/store      → StoreList (context: group)
/groups/[slug]/store/create → CreateProduct (context: group)
/groups/[slug]/store/[id]   → ProductDetail (context: group)
```

**Same components, different routes!**

---

## 📋 Updated Navigation Design

### Individual Context Navigation

```typescript
{
  id: 'business',
  title: 'Business',
  items: [
    { 
      name: 'Store',           // NOT "Products"
      href: '/dashboard/store',
      icon: Package,
      description: 'Your products for sale'
    },
    { 
      name: 'Services',
      href: '/dashboard/services',
      icon: Briefcase,
    },
    // ...
  ],
}
```

### Group Context Navigation

```typescript
{
  id: 'business',
  title: 'Business',
  items: [
    { 
      name: 'Store',           // NOT "Products"
      href: '/groups/[slug]/store',
      icon: Package,
      description: 'Group products for sale'
    },
    { 
      name: 'Services',
      href: '/groups/[slug]/services',
      icon: Briefcase,
    },
    // ...
  ],
}
```

**Key:** Use "Store" in navigation, not "Products"

---

## 🔍 Entity Registry Update

### Current (Needs Update)

```typescript
product: {
  type: 'product',
  name: 'Product',
  namePlural: 'Products',
  basePath: '/dashboard/store',  // ✅ Correct
  // ...
}
```

**Should be:**
- Navigation label: "Store" (not "Products")
- Entity type: "product" (internal)
- Display name: "Product" (for create menu, etc.)

---

## ✅ Summary

**Key Points:**

1. **One Product Table:**
   - `user_products` table (not separate for individuals/groups)
   - `actor_id` determines ownership

2. **Same Products, Different Views:**
   - Individual view: `/dashboard/store` (filter: `actor_id` = user's actor)
   - Group view: `/groups/[slug]/store` (filter: `actor_id` = group's actor)

3. **Navigation:**
   - Use "Store" in navigation (not "Products")
   - Same structure for both contexts
   - Different data source (filtered by `actor_id`)

4. **Association:**
   - Products can be transferred from individual to group
   - Products can be created directly by groups
   - Governance-aware (proposal/voting for democratic groups)

---

**Last Updated:** 2025-12-30

