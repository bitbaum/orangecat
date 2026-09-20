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

/**
 * THE ADMISSION TEST — what makes something an entity here.
 *
 * An entity is anything that can hold a wallet and is better for holding one.
 * That is the whole definition, and it is deliberately a TEST rather than a
 * list: the list below is open in principle, and a new type earns its place by
 * answering the test, not by taste or by resembling the types already here.
 *
 * Each entity sits on three planes, and the wallet is only the first:
 *
 *   OrangeCat  the economy      — it can hold, receive and send value
 *   Solon      the governance   — its decisions can be put to a signed vote
 *   Loki       the execution    — it can be worked on, built and shipped
 *
 * `why` is not decoration. It is the sentence that had to be true before the
 * type was admitted, written in the owner's terms and naming the money that
 * actually moves. A type whose `why` cannot be written without hedging has not
 * passed the test yet.
 *
 * `holds: false` marks a DELIBERATE exception — a row that lives in this
 * registry for a different reason and is not an economic actor. Exceptions are
 * a ratchet: entity-admission.test.ts pins the current set, so the list may
 * shrink and may never quietly grow.
 */
export interface WalletRelation {
  /** Can it hold a wallet, and is it better for holding one? */
  holds: boolean;
  /** One sentence: the money that moves, or what this is instead. */
  why: string;
}

/** Payment pattern for an entity type */
type PaymentPattern = 'fixed_price' | 'contribution' | 'none';

export interface EntityMetadata {
  /** Entity type identifier */
  type: EntityType;
  /**
   * Why this is an entity — see the admission test above. Required, because a
   * type nobody can justify is a type nobody should have added.
   */
  wallet: WalletRelation;
  /**
   * WHEN TO PICK THIS ONE, as a situation rather than a label. Read verbatim
   * into Cat's decision rubric, so the rubric cannot cover fewer types than
   * exist — its hand-written predecessor covered 8 of 15, which is how a
   * research grant got proposed as a project and a wishlist never at all.
   *
   * Phrase it as the thing that is TRUE of the user's situation, not as a
   * description of the type: Cat matches it against what someone just said.
   */
  choose: string;
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
    choose: 'never proposed — it is the account every other type settles into',
    wallet: {
      holds: false,
      why: 'The wallet itself — the primitive every other type is measured against, not a thing that holds one.',
    },
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
    choose: 'money is raised for a defined outcome, and milestones make the spending accountable',
    wallet: {
      holds: true,
      why: 'Backers fund a defined outcome, and the money is held against milestones.',
    },
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
    choose: 'a tangible or digital ITEM changes hands — mugs, bread, an ebook, software',
    wallet: {
      holds: true,
      why: 'A buyer pays a price and a thing changes hands.',
    },
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
    choose:
      "someone's time, skill or labour is sold, even at a fixed price. A price attached to work does NOT make it a product",
    wallet: {
      holds: true,
      why: "Someone pays for the maker's time, and the fee has to land somewhere.",
    },
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
    choose: 'support is open-ended and carries no strings, for ongoing work or need',
    wallet: {
      holds: true,
      why: 'People give with no strings, and the giving needs an address.',
    },
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
    choose:
      "an agent should work and earn on its owner's behalf, with its own purse and its own cap",
    wallet: {
      holds: true,
      why: "It earns and spends on its owner's behalf, so it needs its own purse and its own cap.",
    },
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
    // You do not donate to a companion, you talk to one — and per-message
    // pricing already pays the creator 100% through Cat Credits. Marking this
    // supportable put a five-button "Support with Bitcoin" form on the page,
    // which then ran taller than everything else on it: the one thing a
    // visitor should do (Talk) read as smaller than a donation nobody has
    // ever made (zero payment_intents for this type, checked on the box).
    canReceiveSupport: false,
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
    choose: 'people organise together, with shared funds and a say in how they are spent',
    wallet: {
      holds: true,
      why: 'Members pool funds and decide together how they are spent.',
    },
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
    choose: 'the same people, informally — trust instead of governance ceremony',
    wallet: {
      holds: true,
      why: 'The same shared purse as a group, with less ceremony around the deciding.',
    },
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
    choose: 'something already OWNED could be rented, used or bought by others',
    wallet: {
      holds: true,
      why: 'Rent, deposits and sale prices are owed to whoever holds it. The columns exist (sale_price_btc, rental_price_btc, deposit_amount_btc) and no asset has yet been listed for either, so nothing pays in through OrangeCat.',
    },
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
    choose: 'the user NEEDS money and intends to REPAY it — never a product, never a cause',
    wallet: {
      holds: true,
      why: "A lender and a borrower agree terms against it. Settlement is peer-to-peer and off-platform today — every live loan is fulfillment_type manual — so the wallet is the counterparty's, not ours to move.",
    },
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
    choose: 'capital is taken in exchange for a return or a share, not a repayment schedule',
    wallet: {
      holds: true,
      why: 'Capital goes in and a return is owed.',
    },
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
    choose: 'a gathering is bound to a date and a place',
    wallet: {
      holds: true,
      why: 'Tickets are sold and costs are settled against a date.',
    },
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
    choose: 'independent enquiry is funded transparently by the people who want it done',
    wallet: {
      holds: true,
      why: 'Independent work, funded transparently by the people who want it done.',
    },
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
    choose: 'specific items are wanted and someone may simply buy them — lighter than a cause',
    wallet: {
      holds: true,
      why: 'Specific items are paid for by whoever wants to give them.',
    },
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
    choose: 'structured context for you to read; it receives nothing and owes nothing',
    wallet: {
      holds: false,
      why: 'Context the Cat reads. It receives nothing and owes nothing — the entity is whatever the document is ABOUT.',
    },
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
