import { z } from 'zod';
import { CAT_DOOR } from '@/config/cat-door';

/** The one sentence a visitor hands the Cat before they have an account (/api/cat/first-answer). */
export const firstAnswerSchema = z.object({
  sentence: z
    .string()
    .trim()
    .min(CAT_DOOR.minLength, `Enter at least ${CAT_DOOR.minLength} characters.`)
    .max(CAT_DOOR.maxLength, `Use ${CAT_DOOR.maxLength} characters or fewer.`),
});

export type FirstAnswerInput = z.infer<typeof firstAnswerSchema>;
