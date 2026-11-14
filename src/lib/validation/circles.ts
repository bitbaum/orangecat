/**
 * Circle validation — lightweight community structures.
 */

import { z } from 'zod';
import { optionalText, optionalUrl } from './base';

export const CIRCLE_VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export const CIRCLE_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;

export const circleSchema = z.object({
  title: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: optionalText(1000),
  category: optionalText(50),
  visibility: z.enum(CIRCLE_VISIBILITIES).default('public'),
  cover_image_url: optionalUrl(),
  tags: z.array(z.string()).optional().default([]),
  status: z.enum(CIRCLE_STATUSES).default('active'),
});

export type CircleFormData = z.infer<typeof circleSchema>;
