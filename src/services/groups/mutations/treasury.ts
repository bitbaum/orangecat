/**
 * Treasury Balance Management
 *
 * Handles fetching and updating treasury balances from external APIs.
 * Follows the Network State Development Guide Phase 4.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Initial implementation
 */

import { logger } from '@/utils/logger';
import { DATABASE_TABLES } from '@/config/database-tables';
import supabase from '@/lib/supabase/browser';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import type { ServiceResult } from '@/types/common';
import { fetchAddressBalance } from '@/lib/bitcoin/addressBalance';
import { fromTable } from '../db-helpers';

/**
 * Update treasury balance for a group wallet
 *
 * @param walletId - Wallet ID to update
 * @param balanceBtc - New balance in BTC
 * @param client - Optional Supabase client override
 */
async function updateWalletBalance(
  walletId: string,
  balanceBtc: number,
  client?: AnySupabaseClient
): Promise<ServiceResult> {
  try {
    const sb = client || supabase;

    const { error } = await fromTable(sb, DATABASE_TABLES.GROUP_WALLETS)
      .update({
        current_balance_btc: balanceBtc,
      })
      .eq('id', walletId);

    if (error) {
      logger.error('Failed to update wallet balance', error, 'Groups');
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error('Exception updating wallet balance', error, 'Groups');
    return { success: false, error: 'Failed to update balance' };
  }
}

/**
 * Update treasury balance for a group wallet by fetching from blockchain
 *
 * @param walletId - Wallet ID to update
 * @param client - Optional Supabase client override
 */
export async function refreshWalletBalance(
  walletId: string,
  client?: AnySupabaseClient
): Promise<{ success: boolean; balance?: number; error?: string }> {
  try {
    const sb = client || supabase;
    // Get wallet with Bitcoin address

    const { data: wallet, error: fetchError } = await fromTable(sb, DATABASE_TABLES.GROUP_WALLETS)
      .select('bitcoin_address')
      .eq('id', walletId)
      .single();

    if (fetchError || !wallet) {
      return { success: false, error: 'Wallet not found' };
    }

    if (!wallet.bitcoin_address) {
      return { success: false, error: 'Wallet has no Bitcoin address' };
    }

    let balanceBtc: number;
    try {
      balanceBtc = (await fetchAddressBalance(wallet.bitcoin_address)).balance_btc;
    } catch (error) {
      logger.warn('Treasury balance fetch failed', { walletId, error }, 'Groups');
      return { success: false, error: 'Failed to fetch balance from blockchain' };
    }

    // Update wallet balance
    const updateResult = await updateWalletBalance(walletId, balanceBtc, sb);

    if (!updateResult.success) {
      return updateResult;
    }

    return { success: true, balance: balanceBtc };
  } catch (error) {
    logger.error('Exception refreshing wallet balance', error, 'Groups');
    return { success: false, error: 'Failed to refresh balance' };
  }
}
