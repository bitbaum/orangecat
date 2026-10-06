/**
 * Groups Wallet Mutation Functions
 *
 * Handles wallet/treasury management operations.
 * Unified for both circles and organizations.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Created unified wallet mutations
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type {
  CreateGroupWalletRequest,
  UpdateGroupWalletRequest,
  GroupWalletsResponse,
} from '../types';
import { getCurrentUserId } from '../utils/helpers';
import { logGroupActivity } from '../utils/activity';
import { checkGroupPermission } from '../permissions';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ServiceResult } from '@/types/common';
import { fromTable } from '../db-helpers';

/**
 * Create a group wallet
 */
export async function createGroupWallet(
  request: CreateGroupWalletRequest,
  client?: AnySupabaseClient
): Promise<GroupWalletsResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Check permissions
    const canManage = await checkGroupPermission(request.group_id, userId, 'canManageWallets', sb);
    if (!canManage) {
      return { success: false, error: 'Insufficient permissions' };
    }

    const { data, error } = await fromTable(sb, DATABASE_TABLES.GROUP_WALLETS)
      .insert({
        group_id: request.group_id,
        name: request.name,
        description: request.description || null,
        purpose: request.purpose || 'general',
        bitcoin_address: request.bitcoin_address || null,
        lightning_address: request.lightning_address || null,
        required_signatures: request.required_signatures || 1,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create group wallet', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Log activity
    await logGroupActivity(
      request.group_id,
      userId,
      'created_wallet',
      `Created wallet: ${request.name}`,
      {
        related_wallet_id: data.id,
      },
      sb
    );

    return {
      success: true,
      wallets: [
        {
          id: data.id,
          name: data.name,
          description: data.description || undefined,
          purpose: data.purpose || undefined,
          bitcoin_address: data.bitcoin_address || undefined,
          lightning_address: data.lightning_address || undefined,
          current_balance_btc: data.current_balance_btc || 0,
          is_active: data.is_active,
          can_access: true,
          required_signatures: data.required_signatures || 1,
        },
      ],
    };
  } catch (error) {
    logger.error('Exception creating group wallet', error, 'Groups');
    return { success: false, error: 'Failed to create wallet' };
  }
}

/**
 * Update a group wallet
 */
export async function updateGroupWallet(
  walletId: string,
  request: UpdateGroupWalletRequest,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);
    if (!userId) {
      return { success: false, error: 'Authentication required' };
    }

    // Get wallet to check group_id

    const { data: walletData } = await fromTable(sb, DATABASE_TABLES.GROUP_WALLETS)
      .select('group_id')
      .eq('id', walletId)
      .single();

    const wallet = walletData as { group_id: string } | null;

    if (!wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    // Check permissions
    const canManage = await checkGroupPermission(wallet.group_id, userId, 'canManageWallets', sb);
    if (!canManage) {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Build update payload - only include defined fields
    const payload: Partial<UpdateGroupWalletRequest> = {};
    if (request.name !== undefined) {
      payload.name = request.name;
    }
    if (request.description !== undefined) {
      payload.description = request.description;
    }
    if (request.purpose !== undefined) {
      payload.purpose = request.purpose;
    }
    if (request.bitcoin_address !== undefined) {
      payload.bitcoin_address = request.bitcoin_address;
    }
    if (request.lightning_address !== undefined) {
      payload.lightning_address = request.lightning_address;
    }
    if (request.required_signatures !== undefined) {
      payload.required_signatures = request.required_signatures;
    }
    if (request.is_active !== undefined) {
      payload.is_active = request.is_active;
    }

    const { error } = await fromTable(sb, DATABASE_TABLES.GROUP_WALLETS)
      .update(payload)
      .eq('id', walletId);

    if (error) {
      logger.error('Failed to update group wallet', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error('Exception updating group wallet', error, 'Groups');
    return { success: false, error: 'Failed to update wallet' };
  }
}
