'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { ROUTES } from '@/config/routes';
import EntityListShell from '@/components/entity/EntityListShell';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { TASK_CATEGORIES, TASK_STATUSES, TASK_TYPES } from '@/config/tasks';
import type { Task } from '@/lib/schemas/tasks';
import {
  ClipboardList,
  AlertTriangle,
  Play,
  Clock,
  Filter,
  Plus,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react';
import QuickStatCard from './components/QuickStatCard';
import TaskCard from './components/TaskCard';
import TaskFilters from './components/TaskFilters';
import { GRADIENTS } from '@/config/gradients';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

type TaskCategory = (typeof TASK_CATEGORIES)[keyof typeof TASK_CATEGORIES];
type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

interface TaskWithRelations extends Task {
  creator?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  project?: {
    id: string;
    title: string;
  } | null;
}

export default function TasksPage() {
  const { user, isLoading: authLoading, hydrated } = useRequireAuth();

  const requestVersion = useRef(0);
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | ''>('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<TaskType | ''>('');
  const [showArchived, setShowArchived] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) {
        params.set('category', categoryFilter);
      }
      if (statusFilter) {
        params.set('status', statusFilter);
      }
      if (typeFilter) {
        params.set('task_type', typeFilter);
      }
      if (showArchived) {
        params.set('is_archived', 'true');
      }

      const response = await fetch(`${API_ROUTES.TASKS.BASE}?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to load tasks'));
      }
      if (version === requestVersion.current) {
        setTasks(data.data?.tasks || []);
      }
    } catch (err) {
      if (version !== requestVersion.current) {
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to load tasks';
      logger.error('Failed to load tasks', { error: err }, 'TasksPage');
      setError(message);
      toast.error(message);
    } finally {
      if (version === requestVersion.current) {
        setLoading(false);
      }
    }
  }, [user?.id, categoryFilter, statusFilter, typeFilter, showArchived]);

  useEffect(() => {
    if (hydrated && !authLoading && user) {
      loadTasks();
    }
    return () => {
      requestVersion.current += 1;
    };
  }, [hydrated, authLoading, user, loadTasks]);

  const taskCounts = useMemo(
    () => ({
      total: tasks.length,
      idle: tasks.filter(t => t.current_status === TASK_STATUSES.IDLE).length,
      needsAttention: tasks.filter(t => t.current_status === TASK_STATUSES.NEEDS_ATTENTION).length,
      requested: tasks.filter(t => t.current_status === TASK_STATUSES.REQUESTED).length,
      inProgress: tasks.filter(t => t.current_status === TASK_STATUSES.IN_PROGRESS).length,
    }),
    [tasks]
  );

  const handleComplete = async (taskId: string) => {
    try {
      const response = await fetch(API_ROUTES.TASKS.COMPLETE(taskId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to complete task'));
      }
      toast.success('Task completed!');
      loadTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete task');
    }
  };

  const handleFlagAttention = async (taskId: string) => {
    try {
      const response = await fetch(API_ROUTES.TASKS.ATTENTION(taskId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Needs attention' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(apiErrorMessage(data, 'Failed to flag task'));
      }
      toast.success('Task flagged');
      loadTasks();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to flag task');
    }
  };

  if (authLoading) {
    return <Loading fullScreen message="Loading tasks..." />;
  }
  if (!user) {
    return null;
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button
        href={ROUTES.DASHBOARD.TASKS_ANALYTICS}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <BarChart3 className="h-4 w-4" aria-hidden="true" />
        <span>Analytics</span>
      </Button>
      <Button
        onClick={() => setShowFilters(!showFilters)}
        aria-expanded={showFilters}
        aria-controls="task-filters"
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Filter className="h-4 w-4" />
        <span>Filter</span>
        {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      <Button
        href={ROUTES.DASHBOARD.TASKS_NEW}
        className={`flex items-center gap-2 ${GRADIENTS.brandTiffanyDark}`}
      >
        <Plus className="h-4 w-4" />
        <span>Create Task</span>
      </Button>
    </div>
  );

  return (
    <EntityListShell
      title="Tasks"
      description="Manage and complete team tasks"
      headerActions={headerActions}
    >
      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <QuickStatCard icon={ClipboardList} label="Total" value={taskCounts.total} />
        <QuickStatCard icon={Clock} label="Ready" value={taskCounts.idle} />
        <QuickStatCard
          icon={AlertTriangle}
          label="Needs attention"
          value={taskCounts.needsAttention}
        />
        <QuickStatCard icon={Play} label="In progress" value={taskCounts.inProgress} />
      </div>

      {showFilters && (
        <TaskFilters
          categoryFilter={categoryFilter}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          showArchived={showArchived}
          onCategoryChange={setCategoryFilter}
          onStatusChange={setStatusFilter}
          onTypeChange={setTypeFilter}
          onShowArchivedChange={setShowArchived}
        />
      )}

      {/* Task List */}
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-default bg-surface-base p-6 space-y-3"
        >
          <p className="text-status-negative">{error}</p>
          <Button variant="outline" onClick={loadTasks}>
            Retry loading tasks
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-surface-base rounded-lg border border-default p-4 animate-pulse"
            >
              <div className="h-5 bg-surface-raised rounded w-1/3 mb-2" />
              <div className="h-4 bg-surface-raised rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-surface-base rounded-lg border border-default p-12 text-center">
          <ClipboardList className="h-12 w-12 text-fg-tertiary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg-primary mb-2">No tasks found</h3>
          <p className="text-fg-secondary mb-6">
            {categoryFilter || statusFilter || typeFilter
              ? 'Try different filter settings'
              : 'Create your first task'}
          </p>
          {(categoryFilter || statusFilter || typeFilter || showArchived) && (
            <Button
              variant="outline"
              onClick={() => {
                setCategoryFilter('');
                setStatusFilter('');
                setTypeFilter('');
                setShowArchived(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={() => handleComplete(task.id)}
              onFlagAttention={() => handleFlagAttention(task.id)}
            />
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
