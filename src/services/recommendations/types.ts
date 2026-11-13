/**
 * RECOMMENDATIONS TYPES
 *
 * Type definitions for the dynamic recommendations system.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

import type { LucideIcon } from 'lucide-react';
import type { EntityType } from '@/config/entity-registry';

/**
 * Priority levels for tasks - determines visibility order
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Categories for grouping tasks
 */
export type TaskCategory = 'setup' | 'create' | 'engage' | 'grow';

/**
 * User context for evaluating task conditions
 */
export interface UserContext {
  /** User's profile data */
  profile: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    bio?: string | null;
    avatar_url?: string | null;
    bitcoin_address?: string | null;
    lightning_address?: string | null;
    website?: string | null;
    location?: string | null;
    preferred_currency?: string | null;
  };
  /** Count of entities by type */
  entityCounts: Partial<Record<EntityType, number>>;
  /** Whether user has at least one wallet configured */
  hasWallet: boolean;
  /** Profile completion percentage (0-100) */
  profileCompletion: number;
  /** Days since last activity (entity creation, post, etc.) */
  daysSinceLastActivity: number | null;
  /** Whether user has any published (active) entities */
  hasPublishedEntities: boolean;
  /** Wishlist item count (separate from wishlist count) */
  wishlistItemCount: number;
}

/**
 * Action associated with a task
 */
interface TaskAction {
  /** Button label */
  label: string;
  /** Navigation URL */
  href: string;
  /** Whether link opens in new tab */
  external?: boolean;
}

/**
 * Task definition in the SSOT
 */
export interface TaskDefinition {
  /** Unique task identifier */
  id: string;
  /** Display title */
  title: string;
  /** Description of why this task matters */
  description: string;
  /** Function that returns description (for dynamic descriptions) */
  getDescription?: (context: UserContext) => string;
  /** Task priority */
  priority: TaskPriority;
  /** Task category */
  category: TaskCategory;
  /** Action to complete the task */
  action: TaskAction;
  /** Icon component */
  icon: LucideIcon;
  /** Condition function - task shown only if returns true */
  condition: (context: UserContext) => boolean;
  /** Optional: entity types this task relates to */
  relatedEntities?: EntityType[];
  /** Shown before every other task, whatever its priority. */
  leads?: boolean;
}

/**
 * Evaluated task ready for rendering
 */
export interface RecommendedTask extends Omit<TaskDefinition, 'condition' | 'getDescription'> {
  /** Whether task is completed (for tracking in UI) */
  completed: boolean;
}

/**
 * Smart question for engaged users
 */
export interface SmartQuestion {
  /** Unique question identifier */
  id: string;
  /** Question text */
  question: string;
  /** Suggested action */
  action: TaskAction;
  /** Condition function */
  condition: (context: UserContext) => boolean;
}
