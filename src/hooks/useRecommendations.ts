/**
 * USE RECOMMENDATIONS HOOK
 *
 * Client-side hook for fetching and managing user recommendations.
 * Uses the /api/users/me/stats endpoint.
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { EntityType } from '@/config/entity-registry';
import { API_ROUTES } from '@/config/api-routes';
import type {
  RecommendedTask,
  SmartQuestion,
  TaskPriority,
  TaskCategory,
} from '@/services/recommendations/types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * Response shape from the stats API
 */
interface UserStatsResponse {
  profileCompletion: number;
  entityCounts: Partial<Record<EntityType, number>>;
  hasWallet: boolean;
  hasPublishedEntities: boolean;
  daysSinceLastActivity: number | null;
  wishlistItemCount: number;
  taskCompletion: number;
  recommendations: {
    tasks: RecommendedTask[];
    questions: SmartQuestion[];
    celebration: { title: string; description: string } | null;
  };
}

/**
 * Hook state
 */
interface UseRecommendationsState {
  /** Whether data is loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Profile completion percentage */
  profileCompletion: number;
  /** Task completion percentage (critical + high priority) */
  taskCompletion: number;
  /** Entity counts by type */
  entityCounts: Partial<Record<EntityType, number>>;
  /** Whether user has wallet */
  hasWallet: boolean;
  /** Whether user has published entities */
  hasPublishedEntities: boolean;
  /** Recommended tasks */
  tasks: RecommendedTask[];
  /** Smart questions for engaged users */
  questions: SmartQuestion[];
  /** Celebration message if applicable */
  celebration: { title: string; description: string } | null;
  /** Refresh data */
  refresh: () => Promise<void>;
  /** Mark a task as locally completed (UI only) */
  markTaskCompleted: (taskId: string) => void;
  /** Completed task IDs (local state) */
  completedTaskIds: Set<string>;
}

/**
 * Hook options
 */
interface UseRecommendationsOptions {
  /** Auto-fetch on mount (default: true) */
  enabled?: boolean;
  /** Filter by priority */
  priorities?: TaskPriority[];
  /** Filter by category */
  categories?: TaskCategory[];
  /** Maximum tasks to show */
  limit?: number;
}

/**
 * Fetch and manage user recommendations
 */
export function useRecommendations(
  options: UseRecommendationsOptions = {}
): UseRecommendationsState {
  const { enabled = true, priorities, categories, limit = 6 } = options;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<UserStatsResponse | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.USER.STATS);

      if (!response.ok) {
        throw new Error('Failed to fetch user stats');
      }

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        throw new Error(apiErrorMessage(result, 'Unknown error'));
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      fetchStats();
    }
  }, [enabled, fetchStats]);

  const markTaskCompleted = useCallback((taskId: string) => {
    setCompletedTaskIds(prev => {
      const newSet = new Set(prev);
      newSet.add(taskId);
      return newSet;
    });
  }, []);

  // Filter tasks based on options
  let filteredTasks = data?.recommendations.tasks || [];

  if (priorities && priorities.length > 0) {
    filteredTasks = filteredTasks.filter(t => priorities.includes(t.priority));
  }

  if (categories && categories.length > 0) {
    filteredTasks = filteredTasks.filter(t => categories.includes(t.category));
  }

  // Filter out locally completed tasks
  filteredTasks = filteredTasks.filter(t => !completedTaskIds.has(t.id));

  // Apply limit
  filteredTasks = filteredTasks.slice(0, limit);

  return {
    isLoading,
    error,
    profileCompletion: data?.profileCompletion ?? 0,
    taskCompletion: data?.taskCompletion ?? 0,
    entityCounts: data?.entityCounts ?? {},
    hasWallet: data?.hasWallet ?? false,
    hasPublishedEntities: data?.hasPublishedEntities ?? false,
    tasks: filteredTasks,
    questions: data?.recommendations.questions || [],
    celebration: data?.recommendations.celebration || null,
    refresh: fetchStats,
    markTaskCompleted,
    completedTaskIds,
  };
}

export default useRecommendations;
