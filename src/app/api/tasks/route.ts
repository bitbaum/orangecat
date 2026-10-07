/**
 * Tasks API
 *
 * GET  /api/tasks - List tasks with filters
 * POST /api/tasks - Create a new task
 */

import { NextRequest } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiValidationError,
  apiInternalError,
  apiRateLimited,
  apiSuccess,
} from '@/lib/api/standardResponse';
import { DATABASE_TABLES } from '@/config/database-tables';
import { taskSchema, type TaskFilter } from '@/lib/schemas/tasks';
import { TASK_DEFAULTS } from '@/config/tasks';
import { logger } from '@/utils/logger';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { ilikeAny } from '@/lib/db/likePattern';

export const GET = withAuth(async (request: AuthenticatedRequest) => {
  const { supabase } = request;
  try {
    const { searchParams } = new URL(request.url);
    const filters: TaskFilter = {
      category: searchParams.get('category') || undefined,
      status: searchParams.get('status') || undefined,
      task_type: searchParams.get('task_type') || undefined,
      priority: searchParams.get('priority') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      is_archived: searchParams.get('is_archived') === 'true',
      search: searchParams.get('search') || undefined,
    };
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10));

    let query = supabase
      .from(DATABASE_TABLES.TASKS)
      .select('*, project:task_projects(id, title, status)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!filters.is_archived) {
      query = query.eq('is_archived', false);
    }
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    if (filters.status) {
      query = query.eq('current_status', filters.status);
    }
    if (filters.task_type) {
      query = query.eq('task_type', filters.task_type);
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority);
    }
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id);
    }
    if (filters.search) {
      query = query.or(ilikeAny(['title', 'description'], filters.search));
    }

    const { data: tasks, error, count } = await query;
    if (error) {
      logger.error('Failed to fetch tasks', { error }, 'TasksAPI');
      return apiInternalError('Failed to fetch tasks');
    }

    return apiSuccess({ tasks }, { total: count || 0, limit });
  } catch (err) {
    logger.error('Exception in GET /api/tasks', { error: err }, 'TasksAPI');
    return apiInternalError();
  }
});

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  const { user, supabase } = request;
  try {
    const rl = await rateLimitWriteAsync(user.id);
    if (!rl.success) {
      return apiRateLimited(
        'Too many task creation requests. Please slow down.',
        retryAfterSeconds(rl)
      );
    }

    const body = await (request as NextRequest).json();
    const result = taskSchema.safeParse(body);
    if (!result.success) {
      return apiValidationError('Validation failed', result.error.flatten());
    }

    const d = result.data;
    const { data: task, error } = await supabase
      .from(DATABASE_TABLES.TASKS)
      .insert({
        title: d.title,
        description: d.description || null,
        instructions: d.instructions || null,
        task_type: d.task_type,
        schedule_cron: d.schedule_cron || null,
        schedule_human: d.schedule_human || null,
        category: d.category,
        tags: d.tags || [],
        priority: d.priority || TASK_DEFAULTS.priority,
        estimated_minutes: d.estimated_minutes || null,
        project_id: d.project_id || null,
        current_status: TASK_DEFAULTS.status,
        created_by: user.id,
      })
      .select('*, project:task_projects(id, title, status)')
      .single();

    if (error) {
      logger.error('Failed to create task', { error }, 'TasksAPI');
      return apiInternalError('Failed to create task');
    }

    return apiSuccess({ task }, { status: 201 });
  } catch (err) {
    logger.error('Exception in POST /api/tasks', { error: err }, 'TasksAPI');
    return apiInternalError();
  }
});
