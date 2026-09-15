import {
  TASK_CATEGORY_LABELS,
  TASK_TYPE_LABELS,
  TASK_STATUSES,
  getTaskStatusInfo,
  getPriorityInfo,
} from '@/config/tasks';
import { AlertTriangle, Bell, CheckCircle, Clock } from 'lucide-react';
import type { Task } from '@/lib/schemas/tasks';
import { APP_LOCALE } from '@/utils/locale';

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

interface TaskCardProps {
  task: TaskWithRelations;
  onComplete: () => void;
  onFlagAttention: () => void;
  onClick: () => void;
}

function formatDueDate(dueDate: string): string {
  const date = new Date(dueDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) {
    return 'Overdue';
  }
  if (diffHours < 1) {
    return `${Math.round(diffMs / 60000)} min`;
  }
  if (diffHours < 24) {
    return `${Math.round(diffHours)}h`;
  }
  if (diffHours < 48) {
    return 'Tomorrow';
  }
  return date.toLocaleDateString(APP_LOCALE, { month: 'short', day: 'numeric' });
}

export default function TaskCard({ task, onComplete, onFlagAttention, onClick }: TaskCardProps) {
  const statusInfo = getTaskStatusInfo(task.current_status);
  const priorityInfo = getPriorityInfo(task.priority);
  const isOverdue = task.due_date && new Date(task.due_date) < new Date();

  return (
    <div
      className={`oc-surface oc-card-link cursor-pointer p-4 ${
        isOverdue ? 'border-status-negative/25 bg-status-negative/10' : 'border-default'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {task.is_reminder && (
              <Bell className="h-3.5 w-3.5 text-fg-primary flex-shrink-0" aria-label="Reminder" />
            )}
            <h3 className="text-base font-semibold text-fg-primary truncate">{task.title}</h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
            {task.priority !== 'normal' && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${priorityInfo.className}`}
              >
                {priorityInfo.label}
              </span>
            )}
          </div>
          {task.description && (
            <p className="text-sm text-fg-secondary line-clamp-2 mb-2">{task.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-fg-secondary">
            <span>{TASK_CATEGORY_LABELS[task.category as keyof typeof TASK_CATEGORY_LABELS]}</span>
            <span>&bull;</span>
            <span>{TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS]}</span>
            {task.estimated_minutes && (
              <>
                <span>&bull;</span>
                <span>~{task.estimated_minutes} min</span>
              </>
            )}
            {task.due_date && (
              <>
                <span>&bull;</span>
                <span
                  className={`flex items-center gap-1 ${isOverdue ? 'text-status-negative font-medium' : 'text-fg-secondary'}`}
                >
                  <Clock className="h-3 w-3" />
                  {formatDueDate(task.due_date)}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {task.current_status !== TASK_STATUSES.NEEDS_ATTENTION && (
            <button
              onClick={onFlagAttention}
              className="p-2 text-status-warning hover:bg-status-warning-subtle rounded-lg transition-colors"
              title="Flag as needs attention"
            >
              <AlertTriangle className="h-5 w-5" />
            </button>
          )}
          <button
            onClick={onComplete}
            className="p-2 text-status-positive hover:bg-status-positive-subtle rounded-lg transition-colors"
            title="Mark as complete"
          >
            <CheckCircle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
