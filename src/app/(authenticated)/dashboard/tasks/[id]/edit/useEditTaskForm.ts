import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import type { Task } from '@/lib/schemas/tasks';
import {
  applyTaskAiData,
  validateTaskForm,
  taskFormToPayload,
  type TaskFormData,
} from '../../task-form-types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export function useEditTaskForm(taskId: string, enabled: boolean) {
  const router = useRouter();

  const [formData, setFormData] = useState<TaskFormData | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadTask = useCallback(async () => {
    if (!taskId) {
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(API_ROUTES.TASKS.BY_ID(taskId));
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to load task'));
      }
      const loadedTask: Task = data.data?.task;
      if (loadedTask) {
        setFormData({
          title: loadedTask.title || '',
          description: loadedTask.description || '',
          instructions: loadedTask.instructions || '',
          task_type: loadedTask.task_type as TaskFormData['task_type'],
          schedule_cron: loadedTask.schedule_cron || '',
          schedule_human: loadedTask.schedule_human || '',
          category: loadedTask.category as TaskFormData['category'],
          tags: loadedTask.tags || [],
          priority: loadedTask.priority as TaskFormData['priority'],
          estimated_minutes: loadedTask.estimated_minutes || '',
          project_id: loadedTask.project_id || '',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load task';
      logger.error('Failed to load task', { error: err, taskId }, 'EditTaskPage');
      toast.error(message);
      router.push(ROUTES.DASHBOARD.TASKS);
    } finally {
      setLoading(false);
    }
  }, [taskId, router]);

  useEffect(() => {
    if (enabled) {
      loadTask();
    }
  }, [enabled, loadTask]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => (prev ? { ...prev, [name]: value } : null));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleEstimatedMinutesChange = (value: number | '') => {
    setFormData(prev => (prev ? { ...prev, estimated_minutes: value } : null));
  };

  const handleAIPrefill = (data: Record<string, unknown>) => {
    setFormData(prev => (prev ? applyTaskAiData(prev, data) : null));
    setErrors({});
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (formData && tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
      setFormData(prev => (prev ? { ...prev, tags: [...prev.tags, tag] } : null));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev =>
      prev ? { ...prev, tags: prev.tags.filter(t => t !== tagToRemove) } : null
    );
  };

  const validateForm = (): boolean => {
    if (!formData) {
      return false;
    }
    const newErrors = validateTaskForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData || !validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.TASKS.BY_ID(taskId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskFormToPayload(formData)),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to update task'));
      }
      toast.success('Task updated!');
      router.push(`/dashboard/tasks/${taskId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      logger.error('Failed to update task', { error: err, taskId }, 'EditTaskPage');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    formData,
    tagInput,
    setTagInput,
    loading,
    submitting,
    errors,
    handleChange,
    handleEstimatedMinutesChange,
    handleAIPrefill,
    handleAddTag,
    handleRemoveTag,
    handleSubmit,
  };
}
