'use client';

import { useMemo } from 'react';
import Button from '@/components/ui/Button';
import { Save } from 'lucide-react';
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TASK_CATEGORY_LABELS,
  PRIORITY_LABELS,
} from '@/config/tasks';
import { AI_ASSIST_FORMS } from '@/config/ai-assist-forms';
import { AIPrefillBar } from '@/components/create/AIPrefillBar';
import type { TaskFormData } from './task-form-types';

interface TaskFormFieldsProps {
  formData: TaskFormData;
  tagInput: string;
  setTagInput: (value: string) => void;
  errors: Record<string, string>;
  submitting: boolean;
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => void;
  onEstimatedMinutesChange: (value: number | '') => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  /** When provided, the AI assist bar renders and applies its output here (see applyTaskAiData) */
  onAIPrefill?: (data: Record<string, unknown>) => void;
  /** Which AI-assist framing to use — matches the page the form is on */
  aiMode?: 'create' | 'edit';
  showTaskTypeHint?: boolean;
  submitLabel?: string;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-status-negative text-sm mt-1">{message}</p>;
}

const fieldClass = (hasError: boolean) =>
  `w-full rounded-lg border px-3 py-2 bg-surface-base text-fg-primary focus:outline-none focus:ring-2 focus:ring-ring ${
    hasError ? 'border-status-negative' : 'border-strong'
  }`;

const selectClass =
  'w-full rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring';

export function TaskFormFields({
  formData,
  tagInput,
  setTagInput,
  errors,
  submitting,
  onChange,
  onEstimatedMinutesChange,
  onAddTag,
  onRemoveTag,
  onSubmit,
  onCancel,
  onAIPrefill,
  aiMode = 'create',
  showTaskTypeHint = false,
  submitLabel = 'Save',
}: TaskFormFieldsProps) {
  // The AI only sees (and reports on) the fields it is declared to write to.
  const aiExistingData = useMemo(
    () =>
      Object.fromEntries(
        AI_ASSIST_FORMS.task.fields.map(field => [
          field.name,
          (formData as unknown as Record<string, unknown>)[field.name],
        ])
      ),
    [formData]
  );

  return (
    <form onSubmit={onSubmit} className="p-6 space-y-4">
      {onAIPrefill && (
        <AIPrefillBar
          formType="task"
          mode={aiMode}
          onPrefill={data => onAIPrefill(data)}
          disabled={submitting}
          existingData={aiExistingData}
          fields={AI_ASSIST_FORMS.task.fields}
        />
      )}

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">
          Title <span className="text-status-negative">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={formData.title}
          onChange={onChange}
          placeholder="e.g. Clean kitchen"
          className={fieldClass(!!errors.title)}
        />
        <FieldError message={errors.title} />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">
          Task Type <span className="text-status-negative">*</span>
        </label>
        <select
          name="task_type"
          value={formData.task_type}
          onChange={onChange}
          className={selectClass}
        >
          {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {showTaskTypeHint && (
          <p className="text-xs text-fg-secondary mt-1">
            {formData.task_type === TASK_TYPES.ONE_TIME &&
              'One-time task, marked as completed once done'}
            {formData.task_type === TASK_TYPES.RECURRING_SCHEDULED &&
              'Recurring task with a fixed schedule'}
            {formData.task_type === TASK_TYPES.RECURRING_AS_NEEDED &&
              'Recurring task, completed as needed'}
          </p>
        )}
      </div>

      {formData.task_type === TASK_TYPES.RECURRING_SCHEDULED && (
        <div>
          <label className="block text-sm font-medium text-fg-primary mb-1">Schedule</label>
          <input
            type="text"
            name="schedule_human"
            value={formData.schedule_human}
            onChange={onChange}
            placeholder="e.g. Every Monday, Daily at 9 AM"
            className={selectClass}
          />
          {showTaskTypeHint && (
            <p className="text-xs text-fg-secondary mt-1">
              Describe when this task should be completed
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">
          Category <span className="text-status-negative">*</span>
        </label>
        <select
          name="category"
          value={formData.category}
          onChange={onChange}
          className={selectClass}
        >
          {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Priority</label>
        <select
          name="priority"
          value={formData.priority}
          onChange={onChange}
          className={selectClass}
        >
          {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">
          Estimated Time (Minutes)
        </label>
        <input
          type="number"
          name="estimated_minutes"
          value={formData.estimated_minutes}
          onChange={e => onEstimatedMinutesChange(e.target.value ? parseInt(e.target.value) : '')}
          min={1}
          max={480}
          placeholder="e.g. 30"
          className={fieldClass(!!errors.estimated_minutes)}
        />
        <FieldError message={errors.estimated_minutes} />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Description</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={onChange}
          rows={3}
          placeholder="What needs to be done for this task?"
          className={fieldClass(!!errors.description)}
        />
        <FieldError message={errors.description} />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Instructions</label>
        <textarea
          name="instructions"
          value={formData.instructions}
          onChange={onChange}
          rows={4}
          placeholder="Step-by-step instructions (optional)"
          className={fieldClass(!!errors.instructions)}
        />
        <FieldError message={errors.instructions} />
      </div>

      <div>
        <label className="block text-sm font-medium text-fg-primary mb-1">Tags</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddTag();
              }
            }}
            placeholder="Add tag..."
            className="min-w-0 flex-1 rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="button" variant="outline" onClick={onAddTag} className="min-h-11 shrink-0">
            Add
          </Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-surface-raised rounded-full text-sm dark:text-fg-primary"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => onRemoveTag(tag)}
                  className="text-fg-secondary hover:text-fg-primary"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* The create forms' order and sizes (FormActions): commit first, an
          equal pair of 44px buttons. Cancel came first here. */}
      <div className="grid grid-cols-2 gap-3 pt-4 border-t border-default">
        <Button type="submit" isLoading={submitting} className="min-h-11 w-full">
          <Save className="h-4 w-4 mr-2" />
          {submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="min-h-11 w-full">
          Cancel
        </Button>
      </div>
    </form>
  );
}
