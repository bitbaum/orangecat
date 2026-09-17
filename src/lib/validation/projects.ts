import { z } from 'zod';
import { CURRENCY_CODES } from '@/config/currencies';
import { lightningAddressSchema, optionalText, webUrl } from './base';
import { VALID_PROJECT_STATUSES } from '@/config/project-statuses';

// Project validation
export const projectSchema = z.object({
  title: z
    .string()
    .min(1, 'Project title is required')
    .max(100, 'Project title must be 100 characters or less'),
  description: z
    .string()
    .min(1, 'Project description is required')
    .max(2000, 'Description must be 2000 characters or less'),
  goal_amount: z
    .number({
      error: issue =>
        issue.input === undefined ? 'Funding goal is required' : 'Funding goal must be a number',
    })
    .int('Funding goal must be a whole number')
    .positive('Funding goal must be greater than 0')
    .optional()
    .nullable(),
  currency: z
    .enum(CURRENCY_CODES, {
      error: () => 'Please select a valid currency',
    })
    .optional()
    .nullable(),
  funding_purpose: z
    .string()
    .max(500, 'Funding purpose must be 500 characters or less')
    .optional()
    .nullable(),
  work_status: z
    .string()
    .max(280, 'Current status must be 280 characters or less')
    .optional()
    .nullable(),
  bitcoin_address: z
    .string()
    .refine(val => !val || /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,}$/.test(val), {
      message: 'Please enter a valid Bitcoin address (starts with bc1, 1, or 3)',
    })
    .optional()
    .nullable()
    .or(z.literal('')),
  lightning_address: lightningAddressSchema,
  website_url: webUrl({ message: 'Please enter a valid website URL (e.g., https://example.com)' })
    .optional()
    .nullable()
    .or(z.literal('')),
  category: optionalText(),
  tags: z
    .array(
      z
        .string()
        .min(3, 'Tags must be at least 3 characters')
        .max(20, 'Tags must be 20 characters or less')
    )
    .optional()
    .nullable()
    .default([]),
  start_date: optionalText(),
  target_completion: optionalText(),
  // Public-profile visibility toggle (DB show_on_profile, default true).
  // Optional/no-default — see userProductSchema note. Was absent → the form
  // checkbox was silently stripped by zod on submit.
  show_on_profile: z.boolean().optional(),
  // Integration clients may explicitly publish an active public projection.
  // Browser forms omit this and still create a draft.
  status: z.enum(VALID_PROJECT_STATUSES).optional(),
});

// Types
export type ProjectData = z.infer<typeof projectSchema>;
