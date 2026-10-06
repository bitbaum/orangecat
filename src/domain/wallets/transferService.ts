/**
 * Wallet Transfer Service
 *
 * Business logic for transferring funds between a user's wallets.
 */

import { type Wallet } from '@/types/wallet';
import { logger } from '@/utils/logger';
import { auditSuccess, AUDIT_ACTIONS } from '@/lib/api/auditLog';
import { DATABASE_TABLES, WALLET_CLIENT_COLUMNS } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';

import type { AnySupabaseClient } from '@/lib/supabase/types';

type TransferResult =
  | { ok: true; transaction: Record<string, unknown>; wallets: Wallet[] | null; message: string }
  | {
      ok: false;
      code:
        | 'INVALID_AMOUNT'
        | 'SAME_WALLET'
        | 'NOT_FOUND'
        | 'FORBIDDEN'
        | 'INSUFFICIENT_BALANCE'
        | 'TX_ERROR'
        | 'UPDATE_ERROR';
      message: string;
    };

export async function executeWalletTransfer(
  supabase: AnySupabaseClient,
  userId: string,
  fromWalletId: string,
  toWalletId: string,
  amountBtc: number,
  note?: string
): Promise<TransferResult> {
  // Defense-in-depth: the API boundary validates these, but this service is also
  // callable from CLI/jobs. A non-positive amount or a same-wallet transfer must
  // never reach the balance-move RPC — a negative amount would flow funds the
  // wrong direction (it passes the `balance < amount` check).
  if (!Number.isFinite(amountBtc) || amountBtc <= 0) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'Transfer amount must be positive' };
  }
  if (fromWalletId === toWalletId) {
    return { ok: false, code: 'SAME_WALLET', message: 'Cannot transfer to the same wallet' };
  }

  // Fetch both wallets and verify they exist
  const { data: walletsData, error: walletsError } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select('id, user_id, label, balance_btc, profile_id, project_id')
    .in('id', [fromWalletId, toWalletId])
    .eq('is_active', true);

  if (walletsError) {
    logger.error('Failed to fetch wallets for transfer', {
      userId,
      fromWalletId,
      toWalletId,
      error: walletsError.message,
    });
    return { ok: false, code: 'TX_ERROR', message: 'Failed to fetch wallet information' };
  }

  const wallets = walletsData as Wallet[] | null;
  if (!wallets || wallets.length !== 2) {
    logger.warn('One or both wallets not found for transfer', {
      userId,
      fromWalletId,
      toWalletId,
      walletsFound: wallets?.length ?? 0,
    });
    return { ok: false, code: 'NOT_FOUND', message: 'One or both wallets not found' };
  }

  const fromWallet = wallets.find(w => w.id === fromWalletId);
  const toWallet = wallets.find(w => w.id === toWalletId);

  if (!fromWallet || !toWallet) {
    return { ok: false, code: 'NOT_FOUND', message: 'Wallet not found' };
  }

  // Verify both wallets belong to the requesting user
  if (fromWallet.user_id !== userId || toWallet.user_id !== userId) {
    logger.warn('Unauthorized wallet transfer attempt', {
      userId,
      fromWalletUserId: fromWallet.user_id,
      toWalletUserId: toWallet.user_id,
    });
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'You can only transfer between your own wallets',
    };
  }

  // Check sufficient balance
  if (fromWallet.balance_btc < amountBtc) {
    logger.info('Insufficient balance for transfer', {
      userId,
      fromWalletId,
      availableBtc: fromWallet.balance_btc,
      requestedBtc: amountBtc,
    });
    return {
      ok: false,
      code: 'INSUFFICIENT_BALANCE',
      message: `Insufficient balance. Available: ${fromWallet.balance_btc} BTC, Requested: ${amountBtc} BTC`,
    };
  }

  // Determine entity types for transaction record
  const from_entity_type = fromWallet.profile_id ? 'profile' : 'project';
  const from_entity_id = fromWallet.profile_id || fromWallet.project_id;
  const to_entity_type = toWallet.profile_id ? 'profile' : 'project';
  const to_entity_id = toWallet.profile_id || toWallet.project_id;
  const now = new Date().toISOString();

  // Create transaction record
  const { data: transactionData, error: txError } = await supabase
    .from(DATABASE_TABLES.TRANSACTIONS)
    .insert({
      amount_btc: amountBtc,
      from_entity_type,
      from_entity_id,
      to_entity_type,
      to_entity_id,
      payment_method: 'bitcoin',
      message: note || `Transfer from ${fromWallet.label} to ${toWallet.label}`,
      purpose: 'internal_transfer',
      anonymous: false,
      public_visibility: false,
      status: STATUS.TRANSACTIONS.COMPLETED,
      initiated_at: now,
      confirmed_at: now,
      settled_at: now,
    })
    .select()
    .single();

  if (txError) {
    logger.error('Failed to create transaction record', {
      userId,
      fromWalletId,
      toWalletId,
      error: txError.message,
    });
    return { ok: false, code: 'TX_ERROR', message: 'Failed to create transaction record' };
  }

  const transaction = transactionData as { id: string } & Record<string, unknown>;

  // Update wallet balances via RPC
  const { error: updateError } = await supabase.rpc('transfer_between_wallets', {
    p_from_wallet_id: fromWalletId,
    p_to_wallet_id: toWalletId,
    p_amount_btc: amountBtc,
    p_transaction_id: transaction.id,
  });

  if (updateError) {
    logger.error('Failed to update wallet balances', {
      userId,
      transactionId: transaction.id,
      error: updateError.message,
    });
    return { ok: false, code: 'UPDATE_ERROR', message: 'Failed to update wallet balances' };
  }

  // Fetch updated wallet states
  const { data: updatedWalletsData } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select(WALLET_CLIENT_COLUMNS)
    .in('id', [fromWalletId, toWalletId]);

  await auditSuccess(AUDIT_ACTIONS.WALLET_BALANCE_REFRESHED, userId, 'wallet', fromWalletId, {
    action: 'transfer',
    fromWalletId,
    toWalletId,
    amountBtc,
    transactionId: transaction.id,
    fromWalletLabel: fromWallet.label,
    toWalletLabel: toWallet.label,
  });

  logger.info('Wallet transfer completed successfully', {
    userId,
    fromWalletId,
    toWalletId,
    amountBtc,
    transactionId: transaction.id,
  });

  return {
    ok: true,
    transaction,
    wallets: updatedWalletsData as Wallet[] | null,
    message: `Transferred ${amountBtc} BTC from ${fromWallet.label} to ${toWallet.label}`,
  };
}
