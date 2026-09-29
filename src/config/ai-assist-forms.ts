/**
 * AI-ASSISTABLE STANDALONE FORMS — CONFIG SSOT
 *
 * The AI form assist bar works off a declared field list. Entity forms get
 * theirs from the entity registry / entity configs; the long forms that are
 * NOT registry entities (tasks, group proposals) declare theirs here.
 *
 * One entry = one AI-fillable form. `resolveAiAssistTarget` checks the entity
 * registry first and this catalog second, so a form id here must never collide
 * with an EntityType.
 *
 * Field labels/options are derived from the same config SSOTs the forms
 * themselves render from (TASK_TYPE_LABELS, PROPOSAL_TYPE_SELECT_OPTIONS, …),
 * so the AI's view of a form can't drift from what the user sees.
 *
 * Deliberately absent:
 * - WalletForm — its whole design is "paste one payment handle"; an AI cannot
 *   invent an address, so there is nothing for it to write.
 * - Group settings — two short fields and toggles; the bar would be bigger
 *   than the form.
 */

import type { FieldConfig, SelectOption } from '@/components/create/types';
import {
  TASK_TYPE_LABELS,
  TASK_CATEGORY_LABELS,
  PRIORITY_LABELS,
} from '@/config/tasks';
import { PROPOSAL_TYPE_SELECT_OPTIONS } from '@/config/proposal-constants';

export interface AiAssistFormConfig {
  /** Human name used in prompts and log lines ("Task", "Proposal") */
  name: string;
  /** The fields the AI may write to — same FieldConfig shape as entity configs */
  fields: FieldConfig[];
  /** Form-specific prompt rules (option semantics, sentinel values, …) */
  instructions?: string[];
  /** "Try:" starter descriptions shown in the fill panel */
  examples: string[];
}

/** A value→label record (the shape all our label SSOTs use) as select options. */
function selectOptions(labels: Record<string, string>): SelectOption[] {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

export const AI_ASSIST_FORMS = {
  task: {
    name: 'Task',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      {
        name: 'task_type',
        label: 'Task Type',
        type: 'select',
        options: selectOptions(TASK_TYPE_LABELS),
        required: true,
      },
      {
        name: 'schedule_human',
        label: 'Schedule',
        type: 'text',
        hint: 'When the task should happen, in plain words',
        placeholder: 'Every Monday, Daily at 9 AM',
      },
      {
        name: 'category',
        label: 'Category',
        type: 'select',
        options: selectOptions(TASK_CATEGORY_LABELS),
        required: true,
      },
      {
        name: 'priority',
        label: 'Priority',
        type: 'select',
        options: selectOptions(PRIORITY_LABELS),
      },
      {
        name: 'estimated_minutes',
        label: 'Estimated Time (Minutes)',
        type: 'number',
        min: 1,
        max: 480,
      },
      { name: 'description', label: 'Description', type: 'textarea' },
      {
        name: 'instructions',
        label: 'Instructions',
        type: 'textarea',
        hint: 'Step-by-step instructions for whoever does the task',
      },
      { name: 'tags', label: 'Tags', type: 'tags' },
    ],
    instructions: [
      'For task_type: choose "recurring_scheduled" only when a fixed schedule is stated, and put that schedule into schedule_human in plain words (e.g. "Every Monday at 9 AM"). Otherwise leave schedule_human out.',
      'For estimated_minutes: whole minutes between 1 and 480; set it only when a duration is stated or clearly implied.',
      'For instructions: concrete steps, one per line. Only steps that follow from the description — do not invent tools, locations or products.',
    ],
    examples: [
      'Clean the workshop every Friday afternoon, takes about 45 minutes',
      'Fix the leaking tap in the kitchen — one-time, high priority',
      'Restock printer paper whenever it runs low',
    ],
  },
  proposal: {
    name: 'Proposal',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      {
        name: 'proposal_type',
        label: 'Type',
        type: 'select',
        options: PROPOSAL_TYPE_SELECT_OPTIONS,
      },
      {
        name: 'voting_threshold',
        label: 'Voting Threshold (%)',
        type: 'number',
        min: 1,
        max: 100,
        hint: 'Minimum percentage of yes votes required to pass',
      },
      {
        name: 'voting_ends_at',
        label: 'Voting End Date',
        type: 'date',
        hint: 'When voting closes',
      },
      {
        name: 'amount_btc',
        label: 'Amount (BTC)',
        type: 'currency',
        hint: 'Treasury proposals only — amount to spend',
      },
      {
        name: 'recipient_address',
        label: 'Recipient Bitcoin Address',
        type: 'bitcoin_address',
        hint: 'Treasury proposals only',
      },
    ],
    instructions: [
      'For proposal_type: use "treasury" only when the proposal spends group funds; only then may amount_btc and recipient_address be set. For every other type leave both out.',
      'For voting_ends_at: set it only when an explicit calendar date is given. Never compute a date from relative phrases like "in one week" — leave it out instead.',
      'Never set voting_threshold unless the description states one; the group default applies otherwise.',
    ],
    examples: [
      'Spend 0.01 BTC from the treasury for new workshop tools, recipient bc1q…',
      'Adopt a monthly member meetup, first Thursday each month',
      'Make our project roadmap public on the group page',
    ],
  },
} satisfies Record<string, AiAssistFormConfig>;

export type AiAssistFormId = keyof typeof AI_ASSIST_FORMS;

/** Untyped-key lookup for request handling (form ids arrive as strings). */
export function getAssistFormConfig(formId: string): AiAssistFormConfig | undefined {
  return (AI_ASSIST_FORMS as Record<string, AiAssistFormConfig>)[formId];
}
