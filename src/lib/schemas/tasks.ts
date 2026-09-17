/**
 * Task Management Validation Schemas
 *
 * Zod schemas for all task-related data validation.
 * Types are derived from schemas - SSOT principle.
 *
 * Created: 2026-02-05
 */

import { z } from 'zod';
import {
  TASK_TYPE_OPTIONS,
  TASK_CATEGORY_OPTIONS,
  PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  TASK_PROJECT_STATUS_OPTIONS,
  REQUEST_STATUSES,
  TASK_DEFAULTS,
  TASK_PROJECT_DEFAULTS,
} from '@/config/tasks';

// ==================== TASK SCHEMAS ====================

/**
 * Schema for creating/updating a task
 */
export const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),

  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .nullable(),

  instructions: z
    .string()
    .max(5000, 'Instructions must be at most 5000 characters')
    .optional()
    .nullable(),

  task_type: z.enum(TASK_TYPE_OPTIONS as unknown as [string, ...string[]]),

  schedule_cron: z.string().max(100).optional().nullable(),

  schedule_human: z
    .string()
    .max(200, 'Schedule description must be at most 200 characters')
    .optional()
    .nullable(),

  category: z.enum(TASK_CATEGORY_OPTIONS as unknown as [string, ...string[]]),

  tags: z
    .array(z.string().max(50, 'Tag must be at most 50 characters'))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([]),

  priority: z
    .enum(PRIORITY_OPTIONS as unknown as [string, ...string[]])
    .default(TASK_DEFAULTS.priority),

  estimated_minutes: z
    .number()
    .int()
    .min(1, 'Minimum 1 minute')
    .max(480, 'Maximum 480 minutes (8 hours)')
    .optional()
    .nullable(),

  project_id: z.string().guid('Invalid project ID').optional().nullable(),
});

/**
 * Schema for task update (all fields optional)
 */
export const taskUpdateSchema = taskSchema.partial().extend({
  current_status: z.enum(TASK_STATUS_OPTIONS as unknown as [string, ...string[]]).optional(),
  is_archived: z.boolean().optional(),
});

// ==================== COMPLETION SCHEMA ====================

/**
 * Schema for recording a task completion
 */
export const taskCompletionSchema = z.object({
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional().nullable(),

  duration_minutes: z
    .number()
    .int()
    .min(1, 'Minimum 1 minute')
    .max(480, 'Maximum 480 minutes (8 hours)')
    .optional()
    .nullable(),
});

// ==================== ATTENTION FLAG SCHEMA ====================

/**
 * Schema for flagging a task as needing attention
 */
export const attentionFlagSchema = z.object({
  message: z.string().max(500, 'Message must be at most 500 characters').optional().nullable(),
});

// ==================== REQUEST SCHEMAS ====================

/**
 * Schema for creating a task request
 * requested_user_id = null means broadcast to all staff
 */
export const taskRequestSchema = z.object({
  requested_user_id: z.string().guid('Invalid user ID').optional().nullable(),
  message: z.string().max(500, 'Message must be at most 500 characters').optional().nullable(),
});

/**
 * Schema for responding to a task request
 */
export const requestResponseSchema = z.object({
  status: z.enum([REQUEST_STATUSES.ACCEPTED, REQUEST_STATUSES.DECLINED] as [string, string]),
  response_message: z
    .string()
    .max(500, 'Response must be at most 500 characters')
    .optional()
    .nullable(),
});

// ==================== PROJECT SCHEMA ====================

/**
 * Schema for creating/updating a task project
 */
export const taskProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be at most 200 characters'),

  description: z
    .string()
    .max(2000, 'Description must be at most 2000 characters')
    .optional()
    .nullable(),

  status: z
    .enum(TASK_PROJECT_STATUS_OPTIONS as unknown as [string, ...string[]])
    .default(TASK_PROJECT_DEFAULTS.status),

  target_date: z.string().optional().nullable(),
});

/**
 * Schema for project update (all fields optional)
 */
export const taskProjectUpdateSchema = taskProjectSchema.partial();

// ==================== DERIVED TYPES ====================

/** Input type for updating a task */
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

/** Filter type for task listing */
export type TaskFilter = {
  category?: string;
  status?: string;
  task_type?: string;
  priority?: string;
  project_id?: string;
  is_archived?: boolean;
  search?: string;
};

// ==================== DATABASE TYPES ====================

/**
 * Full task type as stored in database
 */
export interface Task {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  task_type: string;
  schedule_cron: string | null;
  schedule_human: string | null;
  category: string;
  tags: string[];
  priority: string;
  estimated_minutes: number | null;
  current_status: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  project_id: string | null;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  /** ISO timestamp for when this task/reminder is due */
  due_date: string | null;
  /** True when this task was created by My Cat as a reminder */
  is_reminder: boolean;
}

/**
 * Task completion record
 */
export interface TaskCompletion {
  id: string;
  task_id: string;
  completed_by: string;
  completed_at: string;
  notes: string | null;
  duration_minutes: number | null;
  created_at: string;
}

/**
 * Task attention flag
 */
interface TaskAttentionFlag {
  id: string;
  task_id: string;
  flagged_by: string;
  message: string | null;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_by_completion_id: string | null;
  created_at: string;
}

/**
 * Task request
 */
interface TaskRequest {
  id: string;
  task_id: string;
  requested_by: string;
  requested_user_id: string | null;
  is_broadcast: boolean;
  message: string | null;
  status: string;
  response_message: string | null;
  responded_by: string | null;
  completion_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Task project
 */
interface TaskProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  target_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ==================== EXTENDED TYPES (with relations) ====================

/**
 * Task with optional relations
 */
export interface TaskWithRelations extends Task {
  completions?: TaskCompletion[];
  attention_flags?: TaskAttentionFlag[];
  requests?: TaskRequest[];
  project?: TaskProject | null;
  creator?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
  completed_by_user?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  } | null;
}
