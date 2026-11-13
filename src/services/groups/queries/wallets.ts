/**
 * Groups Wallet Query Functions
 *
 * Handles wallet/treasury queries for groups.
 * Unified for both circles and organizations.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-12-30
 * Last Modified Summary: Fixed table/column references to use group_wallets.group_id
 */

import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import type { GroupWalletsResponse, GroupWalletSummary } from '../types';
import { checkGroupPermission } from '../permissions';
import { getCurrentUserId } from '../utils/helpers';
import { DATABASE_TABLES } from '@/config/database-tables';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/**
 * Get group wallets
 */
export async function getGroupWallets(
  groupId: string,
  client?: AnySupabaseClient
): Promise<GroupWalletsResponse> {
  try {
    const sb = client || supabase;
    const userId = await getCurrentUserId(sb);

    // Check permissions
    if (userId) {
      const canView = await checkGroupPermission(groupId, userId, 'canView', sb);
      if (!canView) {
        return { success: false, error: 'Cannot view group wallets' };
      }
    }

    // Query group_wallets table
    const { data, error } = await sb
      .from(DATABASE_TABLES.GROUP_WALLETS)
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get group wallets', error, 'Groups');
      return { success: false, error: error.message };
    }

    // Transform to GroupWalletSummary format
    const wallets: GroupWalletSummary[] =
      data?.map((wallet: Record<string, unknown>) => ({
        id: wallet.id as string,
        name: wallet.name as string,
        description: (wallet.description as string) || undefined,
        purpose: (wallet.purpose as string) || undefined,
        bitcoin_address: (wallet.bitcoin_address as string) || undefined,
        lightning_address: (wallet.lightning_address as string) || undefined,
        current_balance_btc: (wallet.current_balance_btc as number) || 0,
        balance_updated_at: (wallet.balance_updated_at as string | null) ?? null,
        is_active: wallet.is_active as boolean,
        // In the new schema, wallet access is determined by group membership + role
        // Members can view, founders/admins can manage
        can_access: !!userId,
        required_signatures: (wallet.required_signatures as number) || 1,
      })) || [];

    return { success: true, wallets };
  } catch (error) {
    logger.error('Exception getting group wallets', error, 'Groups');
    return { success: false, error: 'Failed to get group wallets' };
  }
}
