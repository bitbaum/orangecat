/**
 * Task Fairness Analytics API
 *
 * GET /api/task-analytics/fairness - Get unique completers per recurring task
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { DATABASE_TABLES } from '@/config/database-tables';
import { TASK_TYPES } from '@/config/tasks';
import { logger } from '@/utils/logger';
import { computeFairnessMetrics } from '@/services/tasks/fairnessAnalytics';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { supabase } = request;
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '90', 10)));
    const categoryFilter = searchParams.get('category') || undefined;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let tasksQuery = supabase
      .from(DATABASE_TABLES.TASKS)
      .select('id, title, category, task_type')
      .eq('is_archived', false)
      .neq('task_type', TASK_TYPES.ONE_TIME);

    if (categoryFilter) {
      tasksQuery = tasksQuery.eq('category', categoryFilter);
    }

    const { data: tasksData, error: tasksError } = await tasksQuery;
    if (tasksError) {
      logger.error('Failed to fetch recurring tasks', { error: tasksError }, 'TaskAnalyticsAPI');
      return apiInternalError('Failed to fetch tasks');
    }

    const recurringTasks = tasksData || [];
    const period = { days, startDate: startDate.toISOString(), endDate: new Date().toISOString() };

    if (recurringTasks.length === 0) {
      return apiSuccess({
        fairnessMetrics: [],
        summary: {
          totalRecurringTasks: 0,
          averageUniqueCompleters: 0,
          tasksWithSingleCompleter: 0,
          period,
        },
      });
    }

    const taskIds = recurringTasks.map((t: { id: string }) => t.id);

    const completionsResult = await supabase
      .from(DATABASE_TABLES.TASK_COMPLETIONS)
      .select('id, task_id, completed_by, completed_at')
      .in('task_id', taskIds)
      .gte('completed_at', startDate.toISOString())
      .order('completed_at', { ascending: false });

    if (completionsResult.error) {
      logger.error(
        'Failed to fetch completions',
        { error: completionsResult.error },
        'TaskAnalyticsAPI'
      );
      return apiInternalError('Failed to fetch completions');
    }

    const completions = completionsResult.data || [];
    const uniqueUserIds = [
      ...new Set(completions.map((c: { completed_by: string }) => c.completed_by)),
    ];
    const profilesMap = new Map<
      string,
      { id: string; username: string; display_name: string | null }
    >();

    if (uniqueUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id, username, display_name:name')
        .in('id', uniqueUserIds);
      for (const p of profiles || []) {
        profilesMap.set(p.id, p);
      }
    }

    const taskMetrics = computeFairnessMetrics(recurringTasks, completions, profilesMap);

    const tasksWithCompletions = taskMetrics.filter(t => t.totalCompletions > 0);
    const avgUniqueCompleters =
      tasksWithCompletions.length > 0
        ? tasksWithCompletions.reduce((sum, t) => sum + t.uniqueCompleterCount, 0) /
          tasksWithCompletions.length
        : 0;

    return apiSuccess({
      fairnessMetrics: taskMetrics,
      summary: {
        totalRecurringTasks: recurringTasks.length,
        averageUniqueCompleters: Math.round(avgUniqueCompleters * 10) / 10,
        tasksWithSingleCompleter: taskMetrics.filter(
          t => t.uniqueCompleterCount === 1 && t.totalCompletions > 3
        ).length,
        tasksNeedingAttention: taskMetrics.filter(t => t.fairnessLevel === 'needs_attention')
          .length,
        period,
      },
    });
  } catch (err) {
    logger.error(
      'Exception in GET /api/task-analytics/fairness',
      { error: err },
      'TaskAnalyticsAPI'
    );
    return apiInternalError();
  }
});
