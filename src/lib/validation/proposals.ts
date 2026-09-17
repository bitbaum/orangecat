import { z } from 'zod';
import { PROPOSAL_TYPES } from '@/config/proposal-constants';

// Proposal schema — used by CreateProposalDialog
export const proposalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
  description: z.string().max(5000, 'Description must be 5000 characters or less').optional(),
  proposal_type: z
    .enum(Object.values(PROPOSAL_TYPES) as [string, ...string[]])
    .default(PROPOSAL_TYPES.GENERAL),
  voting_threshold: z.number().int().min(1).max(100).optional(),
  voting_ends_at: z.string().optional(),
  is_public: z.boolean().optional().default(false),
  // Treasury proposal fields
  amount_btc: z.number().positive().optional(),
  recipient_address: z.string().optional(),
  wallet_id: z.string().guid().optional(),
  // Action type for proposals that execute actions
  action_type: z.string().optional(),
  action_data: z.record(z.string(), z.any()).optional(),
});
export type ProposalFormData = z.input<typeof proposalSchema>;
