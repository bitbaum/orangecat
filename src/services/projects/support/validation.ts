/**
 * Project Support Validation Schemas
 *
 * Zod schemas for validating project support requests.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created project support validation schemas
 */

import { z } from 'zod';

// Support type enum
const supportTypeSchema = z.enum(['bitcoin_funding', 'signature', 'message', 'reaction']);

// Reaction emoji schema
const reactionEmojiSchema = z.enum(['❤️', '👍', '🔥', '🚀', '💪', '🎉', '⭐', '🙌']);

// Base support project schema
export const supportProjectSchema = z
  .object({
    support_type: supportTypeSchema,

    // Bitcoin donation fields
    amount_btc: z.number().positive().optional(),
    lightning_invoice: z.string().optional(),
    transaction_hash: z.string().optional(),

    // Signature/Message fields
    display_name: z.string().min(1).max(100).optional(),
    message: z.string().min(1).max(1000).optional(),
    is_anonymous: z.boolean().optional().default(false),

    // Reaction field
    reaction_emoji: reactionEmojiSchema.optional(),
  })
  .refine(
    data => {
      // Bitcoin donation must have amount_btc
      if (data.support_type === 'bitcoin_funding') {
        return data.amount_btc !== undefined && data.amount_btc > 0;
      }
      return true;
    },
    {
      message: 'Bitcoin donation must include amount_btc',
      path: ['amount_btc'],
    }
  )
  .refine(
    data => {
      // Signature must have display_name
      if (data.support_type === 'signature') {
        return data.display_name !== undefined && data.display_name.length > 0;
      }
      return true;
    },
    {
      message: 'Signature must include display_name',
      path: ['display_name'],
    }
  )
  .refine(
    data => {
      // Message must have message text
      if (data.support_type === 'message') {
        return data.message !== undefined && data.message.length > 0;
      }
      return true;
    },
    {
      message: 'Message must include message text',
      path: ['message'],
    }
  )
  .refine(
    data => {
      // Reaction must have reaction_emoji
      if (data.support_type === 'reaction') {
        return data.reaction_emoji !== undefined;
      }
      return true;
    },
    {
      message: 'Reaction must include reaction_emoji',
      path: ['reaction_emoji'],
    }
  );

// Support filters schema
export const supportFiltersSchema = z.object({
  support_type: supportTypeSchema.optional(),
  is_anonymous: z.boolean().optional(),
  user_id: z.string().guid().optional(),
});

// Support pagination schema
export const supportPaginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});
