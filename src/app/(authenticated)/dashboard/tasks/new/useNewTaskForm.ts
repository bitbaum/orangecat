import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { TASK_DEFAULTS } from '@/config/tasks';
import { API_ROUTES } from '@/config/api-routes';
import {
  applyTaskAiData,
  validateTaskForm,
  taskFormToPayload,
  type TaskFormData,
  type TaskCategory,
  type TaskType,
  type Priority,
} from '../task-form-types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const INITIAL_FORM_DATA: TaskFormData = {
  title: '',
  description: '',
  instructions: '',
  task_type: TASK_DEFAULTS.task_type as TaskType,
  schedule_cron: '',
  schedule_human: '',
  category: TASK_DEFAULTS.category as TaskCategory,
  tags: [],
  priority: TASK_DEFAULTS.priority as Priority,
  estimated_minutes: '',
  project_id: '',
};

export function useNewTaskForm() {
  const router = useRouter();

  const [formData, setFormData] = useState<TaskFormData>(INITIAL_FORM_DATA);
  const [tagInput, setTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleEstimatedMinutesChange = (value: number | '') => {
    setFormData(prev => ({ ...prev, estimated_minutes: value }));
  };

  const handleAIPrefill = (data: Record<string, unknown>) => {
    setFormData(prev => applyTaskAiData(prev, data));
    setErrors({});
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag) && formData.tags.length < 10) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tagToRemove) }));
  };

  const validateForm = (): boolean => {
    const newErrors = validateTaskForm(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.TASKS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskFormToPayload(formData)),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to create task'));
      }
      toast.success('Task created!');
      router.push(`/dashboard/tasks/${data.data.task.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create task';
      logger.error('Failed to create task', { error: err }, 'NewTaskPage');
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    formData,
    tagInput,
    setTagInput,
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
