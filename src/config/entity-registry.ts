/**
 * Entity Registry - Single Source of Truth
 *
 * Central registry for all entity types in the application.
 * Provides:
 * - Type-safe entity type definitions
 * - Centralized routing and navigation
 * - Entity metadata (icons, colors, labels)
 * - Easy addition of new entity types
 *
 * BENEFITS:
 * - Add new entity types in ONE place
 * - Type-safe entity type checking
 * - Consistent navigation patterns
 * - Reduces magic strings throughout codebase
 *
 * Created: 2025-12-16
 * Last Modified: 2025-12-24
 * Last Modified Summary: Added category, priority, createActionLabel fields; fixed wallet path; added color mapping for Tailwind
 */

import type { Database as GeneratedDatabase } from '@/types/database.generated';
import {
  LucideIcon,
  Package,
  Briefcase,
  Heart,
  Coins,
  Users,
  Rocket,
  Wallet,
  Building,
  Bot,
  Calendar,
  Gift,
  FileText,
  TrendingUp,
  FlaskConical,
  CircleDashed,
} from 'lucide-react';

// ==================== ENTITY TYPES ====================

/**
 * All supported entity types - extend this when adding new entities
 */
export const ENTITY_TYPES = [
  'wallet',
  'project',
  'product',
  'service',
  'cause',
  'ai_assistant',
  'group',
  'circle',
  'asset',
  'loan',
  'investment',
  'event',
  'research',
  'wishlist',
  'document',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

// ==================== ENTITY CATEGORIES ====================

/**
 * Entity categories for grouping in UI
 */
export type EntityCategory = 'gateway' | 'business' | 'community' | 'finance' | 'personal';

const ENTITY_CATEGORY_ORDER: EntityCategory[] = [
  'gateway',
  'business',
  'community',
  'finance',
  'personal',
];

// ==================== ENTITY METADATA ====================

/** Payment pattern for an entity type */
type PaymentPattern = 'fixed_price' | 'contribution' | 'none';

export interface EntityMetadata {
  /** Entity type identifier */
  type: EntityType;
  /** Display name (singular) */
  name: string;
  /** Display name (plural) */
  namePlural: string;
  /** Database table name */
  tableName: string;
  /** Column name for user/owner ID (used for RLS queries) */
  userIdField: string;
  /** Public display-title column. Most entities use `title`; groups use `name`. */
  titleColumn?: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Color theme */
  colorTheme: 'orange' | 'tiffany' | 'rose' | 'green';
  /** Base URL path (dashboard) */
  basePath: string;
  /** Create page URL */
  createPath: string;
  /** Public view base path (e.g., /products, /services) - append /{id} for detail view */
  publicBasePath: string;
  /** API endpoint */
  apiEndpoint: string;
  /** Whether this entity type supports templates */
  hasTemplates: boolean;
  /** Short description (for listings) */
  description: string;
  /** Action-oriented label for create menu */
  createActionLabel: string;
  /** Category for grouping in create menu */
  category: EntityCategory;
  /** Priority within category (lower = higher priority) */
  createPriority: number;
  /** How this entity is paid for: fixed_price (buy), contribution (support), none (no payment) */
  paymentPattern: PaymentPattern;
  /**
   * Whether the public page may offer a separate voluntary Bitcoin support
   * action. This is intentionally independent from paymentPattern: a product
   * can still be purchased at a fixed price and supported separately.
   */
  canReceiveSupport: boolean;
  /**
   * SSOT for the column holding a fixed_price entity's price (in its own
   * `currency`, NOT BTC). Read by payment-amount resolution and price display so
   * the column isn't hardcoded per call site. Only meaningful for
   * paymentPattern === 'fixed_price'; omit for contribution/none entities.
   */
  priceColumn?: string;
}

/**
 * Entity metadata registry - add new entities here
 *
 * SINGLE SOURCE OF TRUTH for all entity types.
 * SmartCreateButton and other UI components derive their options from this registry.
 */
/**
 * Table name per entity type — LITERAL-typed, and the only place these strings
 * are written. The registry below reads from here, so there is still exactly
 * one source of truth.
 *
 * Two things this buys that a widened `string` did not:
 *  - `satisfies Record<EntityType, TableName>` fails the build if an entity
 *    points at a table that does not exist in the live schema (TableName is
 *    derived from the generated types).
 *  - `getTableName('cause')` returns the literal `'user_causes'`, so
 *    supabase's `.from()` instantiates ONE query builder instead of one per
 *    table in the schema (that blow-up is what made this migration fail twice).
 */
/** Every table in the live schema, derived from the generated types. */
type TableName = keyof GeneratedDatabase['public']['Tables'];

export const ENTITY_TABLE_NAMES = {
  wallet: 'wallets',
  project: 'projects',
  product: 'user_products',
  service: 'user_services',
  cause: 'user_causes',
  ai_assistant: 'ai_assistants',
  group: 'groups',
  circle: 'circles',
  asset: 'assets',
  loan: 'loans',
  investment: 'investments',
  event: 'events',
  research: 'research_entities',
  wishlist: 'wishlists',
  document: 'user_documents',
} as const satisfies Record<EntityType, TableName>;

/** The tables entity code may query — 15 literals, not every table in the schema. */
export type EntityTableName = (typeof ENTITY_TABLE_NAMES)[EntityType];

export const ENTITY_REGISTRY: Record<EntityType, EntityMetadata> = {
  // ==================== GATEWAY (Foundational) ====================
  wallet: {
    type: 'wallet',
    name: 'Wallet',
    namePlural: 'Wallets',
    tableName: ENTITY_TABLE_NAMES.wallet,
    userIdField: 'profile_id',
    icon: Wallet,
    colorTheme: 'orange',
    basePath: '/dashboard/wallets',
    createPath: '/dashboard/wallets',
    publicBasePath: '/wallets',
    apiEndpoint: '/api/wallets',
    hasTemplates: false,
    description: 'Bitcoin wallet connections',
    createActionLabel: 'Connect a Bitcoin wallet',
    category: 'gateway',
    createPriority: 1,
    paymentPattern: 'none',
    canReceiveSupport: false,
  },

  // ==================== BUSINESS (Core value creation) ====================
  project: {
    type: 'project',
    name: 'Project',
    namePlural: 'Projects',
    tableName: ENTITY_TABLE_NAMES.project,
    userIdField: 'actor_id',
    icon: Rocket,
    colorTheme: 'orange',
    basePath: '/dashboard/projects',
    createPath: '/dashboard/projects/create',
    publicBasePath: '/projects',
    apiEndpoint: '/api/projects',
    hasTemplates: true,
    description: 'Community-funded initiatives',
    createActionLabel: 'Launch a project',
    category: 'business',
    createPriority: 1,
    paymentPattern: 'contribution',
    canReceiveSupport: true,
  },
  product: {
    type: 'product',
    name: 'Product',
    namePlural: 'Products',
    tableName: ENTITY_TABLE_NAMES.product,
    userIdField: 'actor_id',
    icon: Package,
    colorTheme: 'tiffany',
    basePath: '/dashboard/store',
    createPath: '/dashboard/store/create',
    publicBasePath: '/products',
    apiEndpoint: '/api/products',
    hasTemplates: true,
    description: 'Physical or digital products for sale',
    createActionLabel: 'Sell goods in your store',
    category: 'business',
    createPriority: 2,
    paymentPattern: 'fixed_price',
    canReceiveSupport: true,
    priceColumn: 'price',
  },
  service: {
    type: 'service',
    name: 'Service',
    namePlural: 'Services',
    tableName: ENTITY_TABLE_NAMES.service,
    userIdField: 'actor_id',
    icon: Briefcase,
    colorTheme: 'tiffany',
    basePath: '/dashboard/services',
    createPath: '/dashboard/services/create',
    publicBasePath: '/services',
    apiEndpoint: '/api/services',
    hasTemplates: true,
    description: 'Professional services you offer',
    createActionLabel: 'Offer your expertise',
    category: 'business',
    createPriority: 3,
    paymentPattern: 'fixed_price',
    canReceiveSupport: true,
    priceColumn: 'fixed_price',
  },
  cause: {
    type: 'cause',
    name: 'Cause',
    namePlural: 'Causes',
    tableName: ENTITY_TABLE_NAMES.cause,
    userIdField: 'actor_id',
    icon: Heart,
    colorTheme: 'rose',
    basePath: '/dashboard/causes',
    createPath: '/dashboard/causes/create',
    publicBasePath: '/causes',
    apiEndpoint: '/api/causes',
    hasTemplates: false,
    description: 'Charitable causes to support',
    createActionLabel: 'Support a meaningful cause',
    category: 'business',
    createPriority: 4,
    paymentPattern: 'contribution',
    canReceiveSupport: true,
  },
  ai_assistant: {
    type: 'ai_assistant',
    // The TYPE stays `ai_assistant` and so do the tables and the API path:
    // only what a person reads was renamed. A companion is a being with its
    // own soul and a memory of the person it talks to — created privately,
    // published by choice, clonable without its memories.
    name: 'Companion',
    namePlural: 'Companions',
    tableName: ENTITY_TABLE_NAMES.ai_assistant,
    userIdField: 'actor_id',
    icon: Bot,
    colorTheme: 'tiffany',
    basePath: '/dashboard/companions',
    createPath: '/dashboard/companions/create',
    publicBasePath: '/companions',
    apiEndpoint: '/api/ai-assistants',
    hasTemplates: true,
    description: 'AI beings you create, talk to, and can share or sell',
    createActionLabel: 'Create a companion',
    category: 'business',
    createPriority: 5,
    paymentPattern: 'fixed_price',
    canReceiveSupport: true,
  },

  // ==================== COMMUNITY (Network building) ====================
  // The TYPE stays `group` and so do the tables: renaming those is a
  // 10-table migration with RLS policies and functions attached, for zero
  // user-visible gain. What people READ is renamed, and that is what was
  // unclear — the docs page literally explained the feature as "Groups are
  // organizations on OrangeCat", which is the product using the better word
  // to define the worse one.
  group: {
    type: 'group',
    name: 'Organization',
    namePlural: 'Organizations',
    tableName: ENTITY_TABLE_NAMES.group,
    userIdField: 'created_by',
    titleColumn: 'name',
    icon: Users,
    colorTheme: 'tiffany',
    basePath: '/dashboard/groups',
    createPath: '/dashboard/groups/create',
    publicBasePath: '/groups',
    apiEndpoint: '/api/groups',
    hasTemplates: false,
    description: 'Companies, nonprofits, DAOs and communities with a shared identity and treasury',
    createActionLabel: 'Start an organization',
    category: 'community',
    createPriority: 1,
    paymentPattern: 'none',
    canReceiveSupport: true,
  },
  circle: {
    type: 'circle',
    name: 'Circle',
    namePlural: 'Circles',
    tableName: ENTITY_TABLE_NAMES.circle,
    userIdField: 'actor_id',
    icon: CircleDashed,
    colorTheme: 'tiffany',
    basePath: '/dashboard/circles',
    createPath: '/dashboard/circles/create',
    publicBasePath: '/circles',
    apiEndpoint: '/api/circles',
    hasTemplates: false,
    description: 'Lightweight communities and interest circles',
    createActionLabel: 'Start a circle',
    category: 'community',
    createPriority: 2,
    paymentPattern: 'none',
    canReceiveSupport: true,
  },

  // ==================== FINANCE (P2P financial tools) ====================
  asset: {
    type: 'asset',
    name: 'Asset',
    namePlural: 'Assets',
    tableName: ENTITY_TABLE_NAMES.asset,
    userIdField: 'actor_id',
    icon: Building,
    colorTheme: 'green',
    basePath: '/dashboard/assets',
    createPath: '/dashboard/assets/create',
    publicBasePath: '/assets',
    apiEndpoint: '/api/assets',
    hasTemplates: true,
    description: 'Property and valuables you own — rent them out, or pledge them as collateral',
    createActionLabel: 'Rent out or use as collateral',
    category: 'finance',
    createPriority: 1,
    paymentPattern: 'none',
    canReceiveSupport: false,
  },
  loan: {
    type: 'loan',
    name: 'Loan',
    namePlural: 'Loans',
    tableName: ENTITY_TABLE_NAMES.loan,
    userIdField: 'actor_id',
    icon: Coins,
    colorTheme: 'tiffany',
    basePath: '/dashboard/loans',
    createPath: '/dashboard/loans/create',
    publicBasePath: '/loans',
    apiEndpoint: '/api/loans',
    hasTemplates: false,
    description: 'Peer-to-peer Bitcoin loans',
    createActionLabel: 'Request or offer a loan',
    category: 'finance',
    createPriority: 2,
    paymentPattern: 'none',
    canReceiveSupport: false,
  },
  investment: {
    type: 'investment',
    name: 'Investment',
    namePlural: 'Investments',
    tableName: ENTITY_TABLE_NAMES.investment,
    userIdField: 'actor_id',
    icon: TrendingUp,
    colorTheme: 'green',
    basePath: '/dashboard/investments',
    createPath: '/dashboard/investments/create',
    publicBasePath: '/investments',
    apiEndpoint: '/api/investments',
    hasTemplates: false,
    description: 'Equity, revenue-share, and structured investment deals',
    createActionLabel: 'Create an investment opportunity',
    category: 'finance',
    createPriority: 3,
    paymentPattern: 'contribution',
    canReceiveSupport: true,
  },
  event: {
    type: 'event',
    name: 'Event',
    namePlural: 'Events',
    tableName: ENTITY_TABLE_NAMES.event,
    userIdField: 'actor_id',
    icon: Calendar,
    colorTheme: 'tiffany',
    basePath: '/dashboard/events',
    createPath: '/dashboard/events/create',
    publicBasePath: '/events',
    apiEndpoint: '/api/events',
    hasTemplates: true,
    description: 'In-person gatherings and meetups',
    createActionLabel: 'Organize an in-person event',
    category: 'community',
    createPriority: 3,
    paymentPattern: 'fixed_price',
    canReceiveSupport: true,
  },

  // ==================== RESEARCH (DeSci ecosystem) ====================
  research: {
    type: 'research',
    name: 'Research',
    namePlural: 'Research',
    tableName: ENTITY_TABLE_NAMES.research, // Database table name (unchanged for compatibility)
    userIdField: 'actor_id',
    icon: FlaskConical,
    colorTheme: 'tiffany',
    basePath: '/dashboard/research',
    createPath: '/dashboard/research/create',
    publicBasePath: '/research',
    apiEndpoint: '/api/research',
    hasTemplates: true,
    description:
      'Independent research topics with decentralized funding (e.g., Dark Matter, Climate Science)',
    createActionLabel: 'Fund a research topic',
    category: 'business',
    createPriority: 6,
    paymentPattern: 'contribution',
    canReceiveSupport: true,
  },

  // ==================== PERSONAL (Wishlists & Registries) ====================
  wishlist: {
    type: 'wishlist',
    name: 'Wishlist',
    namePlural: 'Wishlists',
    tableName: ENTITY_TABLE_NAMES.wishlist,
    userIdField: 'actor_id',
    icon: Gift,
    colorTheme: 'rose',
    basePath: '/dashboard/wishlists',
    createPath: '/dashboard/wishlists/create',
    publicBasePath: '/wishlists',
    apiEndpoint: '/api/wishlists',
    hasTemplates: true,
    description: 'List items you want - others can buy them for you',
    createActionLabel: 'Create a wishlist',
    category: 'business',
    createPriority: 7,
    paymentPattern: 'contribution',
    canReceiveSupport: true,
  },

  // ==================== PERSONAL (My Cat Context) ====================
  document: {
    type: 'document',
    name: 'Document',
    namePlural: 'Documents',
    tableName: ENTITY_TABLE_NAMES.document,
    userIdField: 'actor_id',
    icon: FileText,
    colorTheme: 'tiffany',
    basePath: '/dashboard/documents',
    createPath: '/dashboard/documents/create',
    publicBasePath: '/documents',
    apiEndpoint: '/api/documents',
    hasTemplates: false,
    description: 'Personal context for your Cat - goals, skills, notes',
    createActionLabel: 'Add context for Cat',
    category: 'personal',
    createPriority: 1,
    paymentPattern: 'none',
    canReceiveSupport: false,
  },
};

// ==================== COLOR MAPPING ====================

/**
 * Static color class mapping for Tailwind CSS
 * Tailwind purges dynamic classes, so we need literal strings
 */
export const COLOR_CLASSES: Record<EntityMetadata['colorTheme'], { text: string; bg: string }> = {
  orange: { text: 'text-amber-700', bg: 'bg-amber-50' },
  tiffany: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
  rose: { text: 'text-rose-600', bg: 'bg-rose-50' },
  green: { text: 'text-green-600', bg: 'bg-green-50' },
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Get entity metadata by type
 */
export function getEntityMetadata(type: EntityType): EntityMetadata {
  return ENTITY_REGISTRY[type];
}

/**
 * Check if a string is a valid entity type
 */
export function isValidEntityType(type: string): type is EntityType {
  return ENTITY_TYPES.includes(type as EntityType);
}

/**
 * Get API endpoint for an entity type
 */
export function getApiEndpoint(type: EntityType): string {
  return ENTITY_REGISTRY[type].apiEndpoint;
}

/**
 * Get database table name for an entity type
 */
export function getTableName<T extends EntityType>(type: T): (typeof ENTITY_TABLE_NAMES)[T] {
  return ENTITY_TABLE_NAMES[type];
}

/**
 * Get user ID field name for an entity type (used for RLS queries)
 */
export function getUserIdField(type: EntityType): string {
  return ENTITY_REGISTRY[type].userIdField;
}

/**
 * Get entities sorted by category and priority for create menu
 * Returns entities in the order they should appear in the dropdown
 */
export function getEntitiesForCreateMenu(): EntityMetadata[] {
  return ENTITY_TYPES.map(type => ENTITY_REGISTRY[type]).sort((a, b) => {
    // First sort by category order
    const categoryOrderA = ENTITY_CATEGORY_ORDER.indexOf(a.category);
    const categoryOrderB = ENTITY_CATEGORY_ORDER.indexOf(b.category);
    if (categoryOrderA !== categoryOrderB) {
      return categoryOrderA - categoryOrderB;
    }
    // Then by priority within category
    return a.createPriority - b.createPriority;
  });
}

/**
 * Get entities grouped by category
 */
export function getEntitiesByCategory(): Record<EntityCategory, EntityMetadata[]> {
  const grouped: Record<EntityCategory, EntityMetadata[]> = {
    gateway: [],
    business: [],
    community: [],
    finance: [],
    personal: [],
  };

  ENTITY_TYPES.forEach(type => {
    const entity = ENTITY_REGISTRY[type];
    grouped[entity.category].push(entity);
  });

  // Sort each category by priority
  Object.keys(grouped).forEach(category => {
    grouped[category as EntityCategory].sort((a, b) => a.createPriority - b.createPriority);
  });

  return grouped;
}

// ==================== EXPORTS ====================

export default ENTITY_REGISTRY;

// Backwards-compatible export for the existing Loki CTA.
export { ORANGECAT_LOKI_INTEGRATION } from './ecosystem';
