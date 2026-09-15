/**
 * Database Constants - Single Source of Truth
 *
 * All status enums, types, and database constants.
 * Prevents magic strings throughout codebase.
 *
 * Benefits:
 * - Safe refactoring (rename status in one place)
 * - Autocomplete support
 * - Prevents typos
 * - Type safety
 * - Easy to find all usages
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial database constants registry
 */

/**
 * Status values for all entities
 *
 * Usage:
 * ```typescript
 * import { STATUS } from '@/config/database-constants';
 *
 * // ✅ GOOD - Type-safe, autocomplete works
 * if (project.status === STATUS.PROJECTS.ACTIVE) { ... }
 *
 * // ❌ BAD - Hardcoded, no type safety
 * if (project.status === 'active') { ... }
 * ```
 */
/**
 * Generic entity status values shared across multiple entity types.
 * Use domain-specific STATUS.ENTITY_TYPE when available.
 */
// The lifecycle every entity table shares. `completed` and `cancelled` are
// PROJECT-specific and live in config/project-statuses.ts — a second
// ENTITY_STATUS carrying them used to sit in status-config.ts, unimported,
// so autocomplete offered two constants of the same name with different
// members and picking the wrong one compiled.
export const ENTITY_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived',
} as const;

export const STATUS = {
  // ProjectStatus lives in config/project-statuses.ts (SSOT)
  PROPOSALS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PASSED: 'passed',
    FAILED: 'failed',
    EXECUTED: 'executed',
    CANCELLED: 'cancelled',
  },
  LOANS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    DEFAULTED: 'defaulted',
    PAID_OFF: 'paid_off',
    REFINANCED: 'refinanced',
    CANCELLED: 'cancelled',
  },
  // DB constraint: CHECK (status IN ('pending','confirmed','in_progress','completed','cancelled','rejected','no_show'))
  BOOKINGS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    REJECTED: 'rejected',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    IN_PROGRESS: 'in_progress',
    NO_SHOW: 'no_show',
  },
  LOAN_OFFERS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
  },
  LOAN_PAYMENTS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },
  TRANSACTIONS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
  },
  // DB constraint: CHECK (status IN ('pending_payment', 'paid', 'shipped', 'completed', 'cancelled', 'refunded'))
  ORDERS: {
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    SHIPPED: 'shipped',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
  },
  // DB constraint: CHECK (status IN ('created', 'invoice_ready', 'paid', 'expired', 'failed', 'buyer_confirmed', 'pending_confirmation'))
  PAYMENT_INTENTS: {
    CREATED: 'created',
    INVOICE_READY: 'invoice_ready',
    PAID: 'paid',
    EXPIRED: 'expired',
    FAILED: 'failed',
    BUYER_CONFIRMED: 'buyer_confirmed',
    PENDING_CONFIRMATION: 'pending_confirmation',
  },
  PRODUCTS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    SOLD_OUT: 'sold_out',
  },
  SERVICES: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    UNAVAILABLE: 'unavailable',
  },
  CAUSES: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  // DB constraint: CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled'))
  RESEARCH: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  MESSAGES: {
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
  },
  GROUP_MEMBERS: {
    FOUNDER: 'founder',
    ADMIN: 'admin',
    MEMBER: 'member',
  },
  GROUP_MEMBER_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  },
  GROUP_EVENTS: {
    GENERAL: 'general',
    MEETING: 'meeting',
    CELEBRATION: 'celebration',
    ASSEMBLY: 'assembly',
  },
  GROUP_EVENT_RSVPS: {
    GOING: 'going',
    MAYBE: 'maybe',
    NOT_GOING: 'not_going',
  },
  // DB constraint: CHECK (location_type IN ('online', 'in_person', 'hybrid'))
  GROUP_EVENT_LOCATION_TYPES: {
    ONLINE: 'online',
    IN_PERSON: 'in_person',
    HYBRID: 'hybrid',
  },
  // DB constraint: CHECK (vote IN ('yes', 'no', 'abstain'))
  PROPOSAL_VOTES: {
    YES: 'yes',
    NO: 'no',
    ABSTAIN: 'abstain',
  },
  GROUP_INVITATIONS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
    REVOKED: 'revoked',
  },
  CONTRACTS: {
    DRAFT: 'draft',
    PROPOSED: 'proposed',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    TERMINATED: 'terminated',
    CANCELLED: 'cancelled',
  },
  AI_ASSISTANTS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    ARCHIVED: 'archived',
  },
  // DB constraint: CHECK (status IN ('active', 'archived'))
  AI_CONVERSATIONS: {
    ACTIVE: 'active',
    ARCHIVED: 'archived',
  },
  // DB constraint: CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
  AI_WITHDRAWALS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },
  INVESTMENTS: {
    DRAFT: 'draft',
    OPEN: 'open',
    FUNDED: 'funded',
    ACTIVE: 'active',
    CLOSED: 'closed',
    CANCELLED: 'cancelled',
  },
  EVENTS: {
    DRAFT: 'draft',
    PUBLISHED: 'published',
    OPEN: 'open',
    FULL: 'full',
    ONGOING: 'ongoing',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  ASSETS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    ARCHIVED: 'archived',
  },
  PROJECTS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  },
  // DB constraint: CHECK (status IN ('pending', 'confirmed', 'rejected', 'expired'))
  CAT_PENDING_ACTIONS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
  },
  PROFILES: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    SUSPENDED: 'suspended',
    DELETED: 'deleted',
  },
} as const;

/**
 * Type helpers for status values (only export types that callers import from this file)
 */
export type InvestmentStatus = (typeof STATUS.INVESTMENTS)[keyof typeof STATUS.INVESTMENTS];
export type AIWithdrawalStatus = (typeof STATUS.AI_WITHDRAWALS)[keyof typeof STATUS.AI_WITHDRAWALS];
export type ProposalVoteValue = (typeof STATUS.PROPOSAL_VOTES)[keyof typeof STATUS.PROPOSAL_VOTES];
