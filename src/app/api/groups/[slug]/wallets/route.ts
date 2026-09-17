/**
 * Group Wallets API
 *
 * POST /api/groups/[slug]/wallets - Create a group wallet (admin/founder only)
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiCreated,
  apiForbidden,
  apiNotFound,
  apiValidationError,
  apiRateLimited,
  handleApiError,
} from '@/lib/api/standardResponse';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { resolveGroupBySlug, checkGroupAdmin } from '@/domain/groups/helpers.server';
import { createGroupWallet } from '@/services/groups/mutations/wallets';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const createWalletSchema = z
  .object({
    name: z.string().min(1, 'Wallet name is required').max(100),
    description: z.string().max(500).optional(),
    purpose: z
      .enum(['general', 'projects', 'investment', 'community', 'emergency', 'savings', 'other'])
      .optional(),
    bitcoin_address: z.string().max(200).optional(),
    lightning_address: z.string().max(200).optional(),
  })
  .refine(data => data.bitcoin_address || data.lightning_address, {
    message: 'Either a Bitcoin address or Lightning address is required',
    path: ['bitcoin_address'],
  });

export const POST = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { user, supabase } = req;

      const rl = await rateLimitWriteAsync(user.id);
      if (!rl.success) {
        return apiRateLimited('Too many requests. Please slow down.', retryAfterSeconds(rl));
      }

      const group = await resolveGroupBySlug(supabase, slug);
      if (!group) {
        return apiNotFound('Group not found');
      }

      const isAdmin = await checkGroupAdmin(supabase, group.id, user.id);
      if (!isAdmin) {
        return apiForbidden('Only group admins and founders can add wallets');
      }

      const body = await req.json();
      const validation = createWalletSchema.safeParse(body);
      if (!validation.success) {
        return apiValidationError('Invalid request data', {
          fields: validation.error.issues.map(i => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        });
      }

      const result = await createGroupWallet(
        {
          group_id: group.id,
          name: validation.data.name,
          description: validation.data.description,
          purpose: validation.data.purpose || 'general',
          bitcoin_address: validation.data.bitcoin_address || undefined,
          lightning_address: validation.data.lightning_address || undefined,
        },
        supabase
      );

      if (!result.success) {
        logger.error(
          'Failed to create group wallet',
          { error: result.error, groupId: group.id },
          'Groups'
        );
        return handleApiError(new Error(apiErrorMessage(result, 'Failed to create wallet')));
      }

      return apiCreated({ wallet: result.wallets?.[0] });
    } catch (error) {
      logger.error('Group wallet POST error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);
