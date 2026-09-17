'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import {
  TASK_CATEGORY_LABELS,
  TASK_TYPE_LABELS,
  getTaskStatusInfo,
  getPriorityInfo,
} from '@/config/tasks';
import {
  Edit,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Send,
  Clock,
  User,
  Calendar,
  Tag,
  FileText,
} from 'lucide-react';
import { useTaskActions } from './useTaskActions';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CompleteModal, AttentionModal, RequestModal } from './TaskActionModals';
import CompletionHistory, { type CompletionWithUser } from './CompletionHistory';
import type { TaskWithRelations } from './types';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export default function TaskDetailPage() {
  const { user, isLoading: authLoading, hydrated } = useRequireAuth();
  const params = useParams();
  const taskId = params?.id as string;

  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [completions, setCompletions] = useState<CompletionWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<'complete' | 'request' | 'attention' | null>(null);

  const loadTask = useCallback(async () => {
    if (!taskId) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_ROUTES.TASKS.BY_ID(taskId));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to load task'));
      }

      const taskData = data.data?.task || null;
      setTask(taskData);
      setCompletions(taskData?.completions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load task';
      logger.error('Failed to load task', { error: err, taskId }, 'TaskDetailPage');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (hydrated && !authLoading && user) {
      loadTask();
    }
  }, [hydrated, authLoading, user, loadTask]);

  const {
    actionLoading,
    handleComplete,
    handleFlagAttention,
    handleRequest,
    archiveConfirmOpen,
    requestArchiveConfirm,
    executeArchive,
    closeArchiveConfirm,
  } = useTaskActions({
    taskId,
    onSuccess: () => {
      setActiveModal(null);
      loadTask();
    },
  });

  if (authLoading || loading) {
    return <Loading fullScreen message="Loading task..." />;
  }

  if (!user) {
    return null;
  }

  if (error || !task) {
    return (
      <div className={cn(GRADIENTS.pageBg, 'min-h-screen p-4 sm:p-6 lg:p-8')}>
        <div className="max-w-3xl mx-auto">
          <Breadcrumb items={[{ label: 'Tasks', href: ROUTES.DASHBOARD.TASKS }]} className="mb-4" />
          <div className="bg-surface-base rounded-lg border border-subtle p-6 text-status-negative">
            {error || 'Task not found'}
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = getTaskStatusInfo(task.current_status);
  const priorityInfo = getPriorityInfo(task.priority);

  return (
    <div className={cn(GRADIENTS.pageBg, 'min-h-screen p-4 sm:p-6 lg:p-8 pb-20 md:pb-8')}>
      <div className="max-w-3xl mx-auto space-y-6">
        <Breadcrumb
          items={[{ label: 'Tasks', href: ROUTES.DASHBOARD.TASKS }, { label: task.title }]}
        />
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button href={`/dashboard/tasks/${taskId}/edit`} variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
            <Button
              onClick={requestArchiveConfirm}
              variant="ghost"
              size="sm"
              className="text-status-negative hover:bg-status-negative/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="bg-surface-base rounded-lg border border-default overflow-hidden">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-fg-primary mb-2">{task.title}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${priorityInfo.className}`}
                  >
                    {priorityInfo.label}
                  </span>
                </div>
              </div>
            </div>

            {task.description && (
              <div className="mb-6">
                <h2 className="text-sm font-medium text-fg-secondary mb-2 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Description
                </h2>
                <p className="text-fg-primary whitespace-pre-wrap">{task.description}</p>
              </div>
            )}

            {task.instructions && (
              <div className="mb-6 bg-surface-raised/40 rounded-lg p-4">
                <h2 className="text-sm font-medium text-fg-primary mb-2">Instructions</h2>
                <p className="text-fg-primary whitespace-pre-wrap">{task.instructions}</p>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-fg-secondary flex items-center gap-1">
                  <Tag className="h-4 w-4" />
                  Category
                </span>
                <span className="font-medium text-fg-primary">
                  {TASK_CATEGORY_LABELS[task.category as keyof typeof TASK_CATEGORY_LABELS]}
                </span>
              </div>
              <div>
                <span className="text-fg-secondary flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Type
                </span>
                <span className="font-medium text-fg-primary">
                  {TASK_TYPE_LABELS[task.task_type as keyof typeof TASK_TYPE_LABELS]}
                </span>
              </div>
              {task.estimated_minutes && (
                <div>
                  <span className="text-fg-secondary flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Estimated Time
                  </span>
                  <span className="font-medium text-fg-primary">
                    ~{task.estimated_minutes} minutes
                  </span>
                </div>
              )}
              {task.creator && (
                <div>
                  <span className="text-fg-secondary flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Created by
                  </span>
                  <span className="font-medium text-fg-primary">
                    {task.creator.display_name || task.creator.username}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-default p-4 bg-surface-raised flex flex-wrap gap-2">
            <Button onClick={() => setActiveModal('complete')} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Done
            </Button>
            <Button
              onClick={() => setActiveModal('request')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              Request
            </Button>
            <Button
              onClick={() => setActiveModal('attention')}
              variant="outline"
              className="flex items-center gap-2 text-status-warning border-subtle hover:bg-status-warning-subtle"
            >
              <AlertTriangle className="h-4 w-4" />
              Flag
            </Button>
          </div>
        </div>

        <CompletionHistory completions={completions} />
      </div>

      {activeModal === 'complete' && (
        <CompleteModal
          estimatedMinutes={task.estimated_minutes}
          actionLoading={actionLoading}
          onClose={() => setActiveModal(null)}
          onComplete={handleComplete}
        />
      )}

      {activeModal === 'attention' && (
        <AttentionModal
          actionLoading={actionLoading}
          onClose={() => setActiveModal(null)}
          onFlag={handleFlagAttention}
        />
      )}

      {activeModal === 'request' && (
        <RequestModal
          actionLoading={actionLoading}
          onClose={() => setActiveModal(null)}
          onRequest={handleRequest}
        />
      )}

      <ConfirmDialog
        isOpen={archiveConfirmOpen}
        onClose={closeArchiveConfirm}
        onConfirm={executeArchive}
        title="Archive this task?"
        description="The task will be archived and removed from your active list."
        confirmLabel="Archive"
      />
    </div>
  );
}
