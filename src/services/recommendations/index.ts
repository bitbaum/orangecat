/**
 * RECOMMENDATIONS SERVICE
 *
 * Dynamic recommendations based on user context.
 * All task definitions are in tasks.ts (SSOT).
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

import {
  TASK_DEFINITIONS,
  SMART_QUESTIONS,
  CELEBRATION_MESSAGES,
  calculateProfileCompletion,
} from './tasks';
import type {
  RecommendedTask,
  UserContext,
  SmartQuestion,
  TaskPriority,
  TaskCategory,
} from './types';

export * from './types';
export { TASK_DEFINITIONS, SMART_QUESTIONS, CELEBRATION_MESSAGES, calculateProfileCompletion };

/**
 * Priority order for sorting tasks
 */
const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Category order for sorting tasks
 */
const CATEGORY_ORDER: Record<TaskCategory, number> = {
  setup: 0,
  create: 1,
  engage: 2,
  grow: 3,
};

/**
 * Get recommended tasks for a user based on their context
 *
 * @param context - User's current state
 * @param options - Filtering options
 * @returns Filtered and sorted list of recommended tasks
 */
export function getRecommendedTasks(
  context: UserContext,
  options: {
    /** Maximum number of tasks to return */
    limit?: number;
    /** Filter by specific categories */
    categories?: TaskCategory[];
    /** Filter by specific priorities */
    priorities?: TaskPriority[];
    /** Include completed tasks */
    includeCompleted?: boolean;
  } = {}
): RecommendedTask[] {
  const {
    limit = 10,
    categories,
    priorities,
    includeCompleted: _includeCompleted = false,
  } = options;

  // Filter tasks by condition
  let eligibleTasks = TASK_DEFINITIONS.filter(task => {
    // Check condition
    if (!task.condition(context)) {
      return false;
    }

    // Filter by category if specified
    if (categories && !categories.includes(task.category)) {
      return false;
    }

    // Filter by priority if specified
    if (priorities && !priorities.includes(task.priority)) {
      return false;
    }

    return true;
  });

  // A leading task first, then by priority, then category.
  eligibleTasks.sort((a, b) => {
    const leadDiff = Number(Boolean(b.leads)) - Number(Boolean(a.leads));
    if (leadDiff !== 0) {
      return leadDiff;
    }
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  });

  // Apply limit
  eligibleTasks = eligibleTasks.slice(0, limit);

  // Convert to RecommendedTask format
  return eligibleTasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.getDescription ? task.getDescription(context) : task.description,
    priority: task.priority,
    category: task.category,
    action: task.action,
    icon: task.icon,
    relatedEntities: task.relatedEntities,
    completed: false,
  }));
}

/**
 * Get smart questions for engaged users
 *
 * @param context - User's current state
 * @param limit - Maximum questions to return
 * @returns List of applicable smart questions
 */
export function getSmartQuestions(context: UserContext, limit: number = 3): SmartQuestion[] {
  return SMART_QUESTIONS.filter(q => q.condition(context)).slice(0, limit);
}

/**
 * Get celebration message based on user state
 *
 * @param context - User's current state
 * @returns Celebration message or null
 */
export function getCelebrationMessage(
  context: UserContext
): { title: string; description: string } | null {
  // Check if profile just became complete
  if (context.profileCompletion === 100) {
    const tasks = getRecommendedTasks(context, {
      categories: ['setup'],
      priorities: ['critical', 'high'],
    });

    // All setup tasks done
    if (tasks.length === 0) {
      // Check if they have entities
      if (context.hasPublishedEntities) {
        return CELEBRATION_MESSAGES.engagementMaster;
      }
      return CELEBRATION_MESSAGES.allSetupComplete;
    }
  }

  return null;
}

/**
 * Get next most important action for user
 *
 * @param context - User's current state
 * @returns Single most important task or null
 */
export function getNextAction(context: UserContext): RecommendedTask | null {
  const tasks = getRecommendedTasks(context, { limit: 1 });
  return tasks[0] || null;
}

/**
 * Build user context from profile and stats
 * Helper for API route
 */
export function buildUserContext(
  profile: UserContext['profile'],
  stats: {
    entityCounts: UserContext['entityCounts'];
    hasWallet: boolean;
    daysSinceLastActivity: number | null;
    hasPublishedEntities: boolean;
    wishlistItemCount: number;
  }
): UserContext {
  return {
    profile,
    entityCounts: stats.entityCounts,
    hasWallet: stats.hasWallet,
    profileCompletion: calculateProfileCompletion(profile),
    daysSinceLastActivity: stats.daysSinceLastActivity,
    hasPublishedEntities: stats.hasPublishedEntities,
    wishlistItemCount: stats.wishlistItemCount,
  };
}
