/**
 * Task Analytics API
 *
 * GET /api/task-analytics - Get dashboard stats
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiInternalError, apiSuccess } from '@/lib/api/standardResponse';
import { DATABASE_TABLES } from '@/config/database-tables';
import { TASK_STATUSES, REQUEST_STATUSES } from '@/config/tasks';
import { logger } from '@/utils/logger';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

    const [
      total,
      pending,
      needsAttn,
      inProgress,
      completedToday,
      completedWeek,
      myToday,
      openRequests,
    ] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.TASKS)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .not('task_type', 'eq', 'one_time'),
      supabase
        .from(DATABASE_TABLES.TASKS)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('current_status', TASK_STATUSES.IDLE),
      supabase
        .from(DATABASE_TABLES.TASKS)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('current_status', TASK_STATUSES.NEEDS_ATTENTION),
      supabase
        .from(DATABASE_TABLES.TASKS)
        .select('*', { count: 'exact', head: true })
        .eq('is_archived', false)
        .eq('current_status', TASK_STATUSES.IN_PROGRESS),
      supabase
        .from(DATABASE_TABLES.TASK_COMPLETIONS)
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', todayStart),
      supabase
        .from(DATABASE_TABLES.TASK_COMPLETIONS)
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', weekStart),
      supabase
        .from(DATABASE_TABLES.TASK_COMPLETIONS)
        .select('*', { count: 'exact', head: true })
        .eq('completed_by', user.id)
        .gte('completed_at', todayStart),
      supabase
        .from(DATABASE_TABLES.TASK_REQUESTS)
        .select('*', { count: 'exact', head: true })
        .eq('status', REQUEST_STATUSES.PENDING)
        .or(`requested_user_id.eq.${user.id},requested_user_id.is.null`)
        .neq('requested_by', user.id),
    ]);

    const { data: rawCompletions } = await supabase
      .from(DATABASE_TABLES.TASK_COMPLETIONS)
      .select(
        'id, completed_at, completed_by, notes, task:tasks!task_completions_task_id_fkey(id, title, category)'
      )
      .order('completed_at', { ascending: false })
      .limit(5);

    // Fetch profiles for recent completers
    const completions = rawCompletions || [];
    const completerIds = [...new Set(completions.map(c => c.completed_by))];
    const profilesMap: Record<
      string,
      { id: string; username: string; display_name: string | null; avatar_url: string | null }
    > = {};
    if (completerIds.length > 0) {
      const { data: profiles } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id, username, display_name:name, avatar_url')
        .in('id', completerIds);
      for (const p of profiles || []) {
        profilesMap[p.id] = p;
      }
    }

    const { data: urgentTasks } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .select('id, title, category, priority, current_status')
      .eq('is_archived', false)
      .or(`current_status.eq.${TASK_STATUSES.NEEDS_ATTENTION},priority.eq.urgent`)
      .order('created_at', { ascending: false })
      .limit(5);

    return apiSuccess({
      stats: {
        total: total.count || 0,
        pending: pending.count || 0,
        needsAttention: needsAttn.count || 0,
        inProgress: inProgress.count || 0,
        completedToday: completedToday.count || 0,
        completedThisWeek: completedWeek.count || 0,
        myCompletedToday: myToday.count || 0,
        openRequests: openRequests.count || 0,
      },
      recentCompletions: completions.map(c => ({
        id: c.id,
        completed_at: c.completed_at,
        notes: c.notes,
        task: c.task,
        completer: profilesMap[c.completed_by] || null,
      })),
      urgentTasks: urgentTasks || [],
    });
  } catch (err) {
    logger.error('Exception in GET /api/task-analytics', { error: err }, 'TaskAnalyticsAPI');
    return apiInternalError();
  }
});
