/**
 * Wallet Update / Delete Domain Service
 *
 * Business logic shared by PATCH and DELETE handlers on /api/wallets/[id].
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { validateAddressOrXpub, detectWalletType, type Wallet } from '@/types/wallet';
import { isValidLightningAddress } from '@/lib/validation/base';
import { encrypt } from '@/domain/payments/encryptionService';
import { logger } from '@/utils/logger';
import { apiBadRequest, apiForbidden, apiNotFound } from '@/lib/api/standardResponse';
import { DATABASE_TABLES, WALLET_CLIENT_COLUMNS } from '@/config/database-tables';
import type { z } from 'zod';
import type { walletUpdateSchema } from '@/lib/validation/finance';
import type { NextResponse } from 'next/server';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { normalizePastedHandle } from '@/lib/wallets/pastedHandle';

type WalletUpdateInput = z.infer<typeof walletUpdateSchema>;

type WalletWithRelations = Wallet & {
  profiles?: { id: string } | null;
  projects?: { user_id: string } | null;
};

type AnyResponse = NextResponse<any>;

interface FetchResult {
  wallet: WalletWithRelations;
  error: null;
}
interface FetchError {
  wallet: null;
  error: AnyResponse;
}

/**
 * Fetch a wallet and verify the caller owns it.
 * Returns the wallet on success, or an HTTP error response on failure.
 */
export async function fetchWalletAndVerifyOwner(
  supabase: SupabaseClient,
  walletId: string,
  userId: string,
  action: string
): Promise<FetchResult | FetchError> {
  const { data: walletData, error: fetchError } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select(
      `${WALLET_CLIENT_COLUMNS}, profiles!wallets_profile_id_fkey(id), projects!wallets_project_id_fkey(user_id)`
    )
    .eq('id', walletId)
    .single();

  const wallet = walletData as WalletWithRelations | null;

  if (fetchError || !wallet) {
    logger.error(`Wallet not found for ${action}`, { walletId, error: fetchError?.message });
    return { wallet: null, error: apiNotFound('Wallet not found') };
  }

  const ownerId = wallet.profile_id
    ? wallet.profiles?.id
    : wallet.project_id
      ? wallet.projects?.user_id
      : null;

  if (ownerId !== userId) {
    logger.warn(`Unauthorized wallet ${action} attempt`, { walletId, userId, ownerId });
    return {
      wallet: null,
      error: apiForbidden(`You do not have permission to ${action} this wallet`),
    };
  }

  return { wallet, error: null };
}

/**
 * Build the DB update object from a validated PATCH body.
 * Returns an error response if the address/xpub is invalid; null otherwise.
 */
export function buildWalletUpdates(
  body: WalletUpdateInput
): { updates: Partial<Wallet>; error: null } | { updates: null; error: AnyResponse } {
  const updates: Partial<Wallet> = {};

  if (body.label !== undefined) {
    updates.label = body.label.trim();
  }
  if (body.description !== undefined) {
    updates.description = body.description?.trim() || null;
  }
  if (body.category !== undefined) {
    updates.category = body.category;
  }
  if (body.category_icon !== undefined) {
    updates.category_icon = body.category_icon;
  }
  if (body.goal_amount !== undefined) {
    updates.goal_amount = body.goal_amount || null;
  }
  if (body.goal_currency !== undefined) {
    updates.goal_currency = body.goal_currency || null;
  }
  if (body.goal_deadline !== undefined) {
    updates.goal_deadline = body.goal_deadline || null;
  }
  if (body.is_primary !== undefined) {
    updates.is_primary = body.is_primary;
  }
  if (body.open_accounting !== undefined) {
    updates.open_accounting = body.open_accounting;
  }

  if (body.address_or_xpub !== undefined) {
    const address = normalizePastedHandle(body.address_or_xpub ?? '');
    if (address) {
      const validation = validateAddressOrXpub(address);
      if (!validation.valid) {
        return {
          updates: null,
          error: apiBadRequest(apiErrorMessage(validation, 'Invalid address or xpub')),
        };
      }
      updates.address_or_xpub = address;
      updates.wallet_type = detectWalletType(address);
    } else {
      // Cleared — the wallet now receives by another rail.
      updates.address_or_xpub = null;
    }
    // The cached chain balance belongs to the old address either way.
    updates.balance_btc = 0;
    updates.balance_updated_at = null;
  }

  if (body.lightning_address !== undefined) {
    const lightningAddress = normalizePastedHandle(body.lightning_address ?? '');
    if (lightningAddress && !isValidLightningAddress(lightningAddress)) {
      return {
        updates: null,
        error: apiBadRequest('Lightning address must look like name@wallet.com'),
      };
    }
    updates.lightning_address = lightningAddress || null;
    if (lightningAddress) {
      updates.wallet_type = 'lightning';
    }
  }

  if (body.nwc_connection_uri !== undefined) {
    const uri = body.nwc_connection_uri?.trim() ?? '';
    if (!uri) {
      updates.nwc_connection_uri = null;
    } else if (!uri.startsWith('nostr+walletconnect://')) {
      return {
        updates: null,
        error: apiBadRequest('Wallet connection must start with nostr+walletconnect://'),
      };
    } else {
      // The URI carries a spending secret — encrypt at rest, exactly as
      // createWallet does. A missing key is an ops gap, not a user error.
      try {
        updates.nwc_connection_uri = encrypt(uri);
        updates.wallet_type = 'lightning';
      } catch (encryptError) {
        logger.error(
          'wallet nwc encrypt failed on update',
          { message: encryptError instanceof Error ? encryptError.message : 'unknown' },
          'updateWallet'
        );
        return {
          updates: null,
          error: apiBadRequest('Wallet connections are not available on this deployment yet.'),
        };
      }
    }
  }

  updates.updated_at = new Date().toISOString();
  return { updates, error: null };
}

/**
 * When is_primary is set to true, unset all other wallets for the same entity.
 */
export async function enforceSinglePrimary(
  supabase: SupabaseClient,
  wallet: WalletWithRelations,
  walletId: string
): Promise<void> {
  const entityFilter = wallet.profile_id
    ? { profile_id: wallet.profile_id }
    : { project_id: wallet.project_id };

  // Deliberately NOT scoped to active rows. Restricting the sweep to
  // `is_active = true` was how stranded flags survived: a wallet deactivated
  // while primary could never be reached again by any later promotion, so the
  // "one primary" invariant silently accumulated exceptions. Clearing every
  // sibling — live or soft-deleted — is what makes this function's name true.
  await supabase
    .from(DATABASE_TABLES.WALLETS)
    .update({ is_primary: false })
    .neq('id', walletId)
    .match(entityFilter);
}
