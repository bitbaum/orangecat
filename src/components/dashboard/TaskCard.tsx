'use client';

/**
 * A single recommended-task row + its priority styling. Extracted from
 * TasksSection.tsx to keep that component under 300 lines. Presentational:
 * the parent owns task state and passes complete/incomplete handlers.
 */
import { CheckCircle2, Circle, ArrowRight, Target } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { TASK_DEFINITIONS } from '@/services/recommendations/tasks';
import type { RecommendedTask, TaskPriority } from '@/services/recommendations/types';
import type { LucideIcon } from 'lucide-react';

const TASK_ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  TASK_DEFINITIONS.map(task => [task.id, task.icon])
);

export function getPriorityColor(priority: TaskPriority): string {
  // Loki semantic tier (migration 6/N): critical + high get
  // chromatic status tokens; medium + low fade into neutral so the eye
  // is drawn to actual urgency.
  switch (priority) {
    case 'critical':
      return 'border-status-negative/30 bg-status-negative-subtle text-status-negative';
    case 'high':
      return 'border-status-warning/30 bg-status-warning-subtle text-status-warning';
    case 'medium':
      return 'border-subtle bg-surface-raised text-fg-secondary';
    case 'low':
      return 'border-subtle bg-surface-raised/60 text-fg-tertiary';
  }
}

export function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'critical':
      return 'Critical';
    case 'high':
      return 'Important';
    case 'medium':
      return 'Suggested';
    case 'low':
      return 'Optional';
  }
}

export function TaskCard({
  task,
  onComplete,
  isCompleted,
}: {
  task: RecommendedTask;
  onComplete: () => void;
  isCompleted: boolean;
}) {
  const IconComponent = TASK_ICON_MAP[task.id] || Target;

  return (
    <div
      className={`
        flex items-start gap-4 rounded-md border p-4 transition-colors
        ${isCompleted ? 'border-subtle bg-surface-raised/50 opacity-70' : 'border-subtle hover:border-strong hover:bg-surface-raised/30'}
      `}
    >
      <button
        onClick={onComplete}
        className="mt-0.5 flex-shrink-0 text-fg-tertiary transition-colors hover:text-fg-primary"
        aria-label={isCompleted ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5 text-status-positive" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <IconComponent className="w-4 h-4 text-fg-secondary flex-shrink-0" />
              <h4
                className={`font-medium ${isCompleted ? 'line-through text-fg-secondary' : 'text-fg-primary'}`}
              >
                {task.title}
              </h4>
              <span
                className={`rounded-sm border px-2 py-0.5 text-xs ${getPriorityColor(task.priority)}`}
              >
                {getPriorityLabel(task.priority)}
              </span>
            </div>

            <p className="text-sm text-fg-secondary mb-3">{task.description}</p>

            {!isCompleted && (
              <Link href={task.action.href}>
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:border-strong hover:bg-surface-raised hover:text-fg-primary"
                >
                  {task.action.label}
                  <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
