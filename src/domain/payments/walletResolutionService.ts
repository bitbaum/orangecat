/**
 * Wallet Resolution Service
 *
 * Given an entity, finds the seller's wallet and determines
 * the best available payment method: NWC > Lightning Address > On-chain.
 *
 * Supports both user actors (personal wallets) and group actors (group_wallets).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { decrypt } from './encryptionService';
import { deriveOnchainAddress } from './addressDerivation';
import { detectWalletType } from '@/types/wallet';
import type { ResolvedWallet } from './types';
import { logger } from '@/utils/logger';

/**
 * Resolve the best payment method for a given entity's seller.
 *
 * Priority: NWC > Lightning Address > On-chain BTC address
 *
 * For user-owned entities, looks up the user's wallets table.
 * For group-owned entities, looks up the group_wallets table.
 *
 * Returns null if seller has no wallet connected.
 */
export async function resolveSellerWallet(
  entityType: EntityType,
  entityId: string
): Promise<ResolvedWallet | null> {
  // Use admin client for cross-user seller lookups (actor + wallet tables).
  // The buyer's JWT cannot see the seller's actor record due to RLS.
  // Cast to untyped client — queries use dynamic column names from entity registry.
  const admin = getAdminClient() as unknown as SupabaseClient;

  // Step 0: Entity-specific wallet override. If the owner explicitly tied a
  // wallet to THIS entity (entity_wallets), that wallet receives the funds —
  // regardless of which wallet is their profile default. Owners may have
  // multiple addresses and route different entities to different ones. Falls
  // through to the owner's primary wallet (Step 1) when no link exists.
  const linked = await resolveLinkedEntityWallet(admin, entityType, entityId);
  if (linked) {
    return linked;
  }

  // A group is itself the receiving organization. Never silently route club
  // support into the founder's personal wallet just because `groups.created_by`
  // is also its ownership field.
  if (entityType === 'group') {
    return resolveGroupWallet(admin, entityId);
  }

  // Step 1: Find the entity's owner (seller)
  const meta = getEntityMetadata(entityType);
  const { data: entity, error: entityError } = await admin
    .from(meta.tableName)
    .select(`id, ${meta.userIdField}`)
    .eq('id', entityId)
    .single();

  if (entityError || !entity) {
    logger.error('Entity not found for wallet resolution', {
      entityType,
      entityId,
      error: entityError,
    });
    return null;
  }

  // The userIdField could be actor_id, user_id, or profile_id
  const ownerId = (entity as any)[meta.userIdField] as string;

  // Step 2: Resolve the owner to an actor or user ID
  // If userIdField is actor_id, look up the actor to determine if it's a user or group
  if (meta.userIdField === 'actor_id') {
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('actor_type, user_id, group_id')
      .eq('id', ownerId)
      .single();

    if (!actor) {
      logger.error('Actor not found for wallet resolution', { actorId: ownerId });
      return null;
    }

    if (actor.actor_type === 'group' && actor.group_id) {
      // Group actor: resolve wallet from group_wallets table
      return resolveGroupWallet(admin, actor.group_id);
    }

    if (!actor.user_id) {
      logger.error('User actor missing user_id', { actorId: ownerId });
      return null;
    }

    // User actor: resolve wallet from wallets table
    return resolveUserWallet(admin, actor.user_id);
  }

  // profile_id or user_id maps directly to auth user id
  return resolveUserWallet(admin, ownerId);
}

/** Display-safe receiving info for an entity (no secrets — never the NWC URI). */
export interface SellerReceiveInfo {
  method: ResolvedWallet['method'];
  /**
   * Receiving address to show: the Lightning address or on-chain address.
   * Null for NWC (a connection has no static address to display).
   */
  address: string | null;
}

/**
 * Resolve display-safe receiving info for an entity, reusing the same wallet
 * resolution the payment flow uses (SSOT) so what the owner sees matches what
 * buyers will actually pay to. Returns null when no wallet is connected.
 */
export async function resolveSellerReceiveInfo(
  entityType: EntityType,
  entityId: string
): Promise<SellerReceiveInfo | null> {
  const resolved = await resolveSellerWallet(entityType, entityId);
  if (!resolved) {
    return null;
  }

  const address =
    resolved.method === 'lightning_address'
      ? (resolved.lightning_address ?? null)
      : resolved.method === 'onchain'
        ? (resolved.onchain_address ?? null)
        : null;

  return { method: resolved.method, address };
}

/**
 * Get the seller's user ID for a given entity.
 * Used when creating payment intents to populate seller_id.
 *
 * For user actors, returns the user's auth ID directly.
 * For group actors, returns the group founder's user ID (created_by),
 * which is used for notifications and access control on the payment intent.
 */
export async function getSellerUserId(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<string | null> {
  // Use admin client: buyer's JWT cannot see the seller's actor record due to RLS.
  // Cast to untyped client — queries use dynamic column names from entity registry.
  const admin = getAdminClient() as unknown as SupabaseClient;
  const meta = getEntityMetadata(entityType);
  const { data: entity } = await admin
    .from(meta.tableName)
    .select(`id, ${meta.userIdField}`)
    .eq('id', entityId)
    .single();

  if (!entity) {
    return null;
  }

  const ownerId = (entity as any)[meta.userIdField] as string;

  if (meta.userIdField === 'actor_id') {
    const { data: actor } = await admin
      .from(DATABASE_TABLES.ACTORS)
      .select('actor_type, user_id, group_id')
      .eq('id', ownerId)
      .single();

    if (!actor) {
      return null;
    }

    // User actor: return user_id directly
    if (actor.actor_type === 'user') {
      return actor.user_id ?? null;
    }

    // Group actor: return the group founder's user_id for notifications/access control
    if (actor.actor_type === 'group' && actor.group_id) {
      const { data: group } = await admin
        .from(DATABASE_TABLES.GROUPS)
        .select('created_by')
        .eq('id', actor.group_id)
        .single();
      return group?.created_by ?? null;
    }

    return null;
  }

  return ownerId;
}

// =====================================================================
// INTERNAL HELPERS
// =====================================================================

/** A wallet row shaped for payment-method selection. */
interface WalletRow {
  id: string;
  nwc_connection_uri?: string | null;
  lightning_address?: string | null;
  address_or_xpub?: string | null;
}

/**
 * Classify `address_or_xpub` into what it actually is.
 *
 * A plain address is payable as-is. An extended public key is NOT an address —
 * it is the key you derive addresses FROM — so it must never be handed to a
 * payer verbatim (`bitcoin:xpub6...` is a QR no wallet can pay; that shipped
 * once). An xpub wallet is still a valid on-chain destination: resolution
 * carries the key, and `materializeOnchainAddress` derives a fresh address at
 * invoice-creation time.
 *
 * Derivation happens ONLY at invoice creation, never here: resolution also
 * backs read-only surfaces (the owner's receive status), and allocating an
 * index per status check would burn through the wallet's gap limit.
 */
function classifyOnchain(value?: string | null): { address?: string; xpub?: string } {
  if (!value) {
    return {};
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  return detectWalletType(trimmed) === 'address' ? { address: trimmed } : { xpub: trimmed };
}

function onchainResolution(walletId: string, value?: string | null): ResolvedWallet | null {
  const { address, xpub } = classifyOnchain(value);
  if (address) {
    return { method: 'onchain', wallet_id: walletId, onchain_address: address };
  }
  if (xpub) {
    return { method: 'onchain', wallet_id: walletId, onchain_xpub: xpub };
  }
  return null;
}

/**
 * Pick the best payment method from a SINGLE wallet row.
 * Priority: NWC > Lightning Address > On-chain. Returns null if the wallet has
 * no usable payment detail (or its NWC URI fails to decrypt).
 */
function pickMethodFromWallet(wallet: WalletRow): ResolvedWallet | null {
  if (wallet.nwc_connection_uri) {
    try {
      return { method: 'nwc', wallet_id: wallet.id, nwc_uri: decrypt(wallet.nwc_connection_uri) };
    } catch (e) {
      // warn, not error. A URI this key cannot open is a permanent, per-wallet,
      // OWNER-FIXABLE state, not an application fault: the key was rotated (or
      // the row was written by a machine with a different key) and the
      // plaintext is gone for good. The wallet card already tells the owner to
      // paste the connection string again (receiveStatus.ts -> WalletCard), so
      // this line is a breadcrumb, not an incident.
      //
      // It fires on EVERY payment resolution for that wallet and can never
      // self-resolve, so at error level one dead test wallet emitted 21 of the
      // 25 error-level log lines this app produced in three days — enough to
      // bury a real one.
      logger.warn('NWC URI could not be decrypted; wallet skipped for payments', {
        walletId: wallet.id,
        remedy: 'owner must reconnect the wallet — the stored URI predates the current key',
        error: e,
      });
      // Fall through to next method
    }
  }

  if (wallet.lightning_address) {
    return {
      method: 'lightning_address',
      wallet_id: wallet.id,
      lightning_address: wallet.lightning_address,
    };
  }

  return onchainResolution(wallet.id, wallet.address_or_xpub);
}

/**
 * Turn a resolved on-chain wallet into one carrying a concrete, payable,
 * NEVER-REUSED address. Call this at invoice creation — and only there.
 *
 * For an xpub wallet this atomically claims the next derivation index
 * (`allocate_derivation_index`, service-role RPC) and derives external-chain
 * address 0/index. Uniqueness per intent is what makes on-chain settlement
 * detection sound: (address, amount, window) matching can only be trusted when
 * nobody else ever pays that address — the reused-address false-settle of
 * 2026-07-31 is the counterexample.
 *
 * Throws rather than degrades: an invoice we cannot mint an address for must
 * fail loudly, not fall back to something unpayable or ambiguous.
 */
export async function materializeOnchainAddress(wallet: ResolvedWallet): Promise<ResolvedWallet> {
  if (wallet.method !== 'onchain' || wallet.onchain_address) {
    return wallet;
  }
  if (!wallet.onchain_xpub) {
    throw new Error('On-chain wallet has neither an address nor an extended public key');
  }

  const admin = getAdminClient() as unknown as SupabaseClient;
  const { data: index, error } = await admin.rpc('allocate_derivation_index', {
    p_wallet_id: wallet.wallet_id,
  });
  if (error || typeof index !== 'number') {
    logger.error('Failed to allocate derivation index', { walletId: wallet.wallet_id, error });
    throw new Error('Failed to allocate a receiving address');
  }

  const address = deriveOnchainAddress(wallet.onchain_xpub, index);
  logger.info(
    'Derived per-invoice on-chain address',
    { walletId: wallet.wallet_id, index },
    'addressDerivation'
  );
  return { ...wallet, onchain_address: address };
}

/**
 * Resolve the wallet explicitly linked to a specific entity via entity_wallets.
 * is_primary-first so the choice is deterministic when several are linked.
 * Returns null when no active linked wallet yields a usable payment method.
 */
async function resolveLinkedEntityWallet(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<ResolvedWallet | null> {
  const { data: links } = await supabase
    .from(DATABASE_TABLES.ENTITY_WALLETS)
    .select('wallet_id, is_primary')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('is_primary', { ascending: false });

  if (!links || links.length === 0) {
    return null;
  }

  for (const link of links as Array<{ wallet_id: string }>) {
    const { data: wallet } = await supabase
      .from(DATABASE_TABLES.WALLETS)
      .select('id, nwc_connection_uri, lightning_address, address_or_xpub')
      .eq('id', link.wallet_id)
      .eq('is_active', true)
      .single();

    if (!wallet) {
      continue;
    }

    const resolved = pickMethodFromWallet(wallet as WalletRow);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/**
 * Resolve best wallet for a user from the wallets table.
 * Priority across wallets: a wallet with NWC > one with a Lightning Address >
 * one with an on-chain address. Primary wallet wins ties (ordered first).
 */
export async function resolveUserWallet(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedWallet | null> {
  const { data: wallets } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select('id, nwc_connection_uri, lightning_address, address_or_xpub, wallet_type, is_primary')
    .eq('profile_id', userId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (!wallets || wallets.length === 0) {
    return null;
  }

  // Check for NWC
  const nwcWallet = wallets.find(w => w.nwc_connection_uri);
  if (nwcWallet) {
    try {
      const decryptedUri = decrypt(nwcWallet.nwc_connection_uri!);
      return {
        method: 'nwc',
        wallet_id: nwcWallet.id,
        nwc_uri: decryptedUri,
      };
    } catch (e) {
      // Same permanent, owner-fixable state as pickMethodFromWallet above.
      logger.warn('NWC URI could not be decrypted; wallet skipped for payments', {
        walletId: nwcWallet.id,
        remedy: 'owner must reconnect the wallet — the stored URI predates the current key',
        error: e,
      });
      // Fall through to next method
    }
  }

  // Check for Lightning Address
  const lnWallet = wallets.find(w => w.lightning_address);
  if (lnWallet) {
    return {
      method: 'lightning_address',
      wallet_id: lnWallet.id,
      lightning_address: lnWallet.lightning_address!,
    };
  }

  // Check for on-chain destination (a plain address, or an xpub that
  // materializeOnchainAddress will derive from at invoice time).
  const onchainWallet = wallets.find(
    w =>
      onchainResolution(w.id, w.address_or_xpub) &&
      (w.wallet_type === 'onchain' || w.wallet_type === 'both' || w.wallet_type === 'xpub')
  );
  if (onchainWallet) {
    return onchainResolution(onchainWallet.id, onchainWallet.address_or_xpub);
  }

  // Fallback: the first wallet holding any on-chain destination.
  for (const w of wallets) {
    const resolved = onchainResolution(w.id, w.address_or_xpub);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

/**
 * Resolve ONE SPECIFIC wallet of a user into a payment method — the owner
 * picked it explicitly (e.g. the /receive wallet switcher), so no cross-wallet
 * priority applies; only the within-wallet NWC > Lightning > on-chain order.
 * Ownership is part of the query: a wallet id belonging to someone else (or an
 * inactive wallet) resolves to null, never to a payable rail.
 */
export async function resolveSpecificUserWallet(
  supabase: SupabaseClient,
  userId: string,
  walletId: string
): Promise<ResolvedWallet | null> {
  const { data: wallet } = await supabase
    .from(DATABASE_TABLES.WALLETS)
    .select('id, nwc_connection_uri, lightning_address, address_or_xpub')
    .eq('id', walletId)
    .eq('profile_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!wallet) {
    return null;
  }
  return pickMethodFromWallet(wallet as WalletRow);
}

/**
 * Resolve best wallet for a group from the group_wallets table.
 * Priority: Lightning Address > On-chain (group_wallets has no NWC support)
 */
async function resolveGroupWallet(
  supabase: SupabaseClient,
  groupId: string
): Promise<ResolvedWallet | null> {
  const { data: wallets } = await supabase
    .from(DATABASE_TABLES.GROUP_WALLETS)
    .select('id, lightning_address, bitcoin_address, is_active')
    .eq('group_id', groupId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (!wallets || wallets.length === 0) {
    logger.warn('No active group wallets found', { groupId });
    return null;
  }

  // Check for Lightning Address
  const lnWallet = wallets.find(w => w.lightning_address);
  if (lnWallet) {
    return {
      method: 'lightning_address',
      wallet_id: lnWallet.id,
      lightning_address: lnWallet.lightning_address!,
    };
  }

  // Check for on-chain Bitcoin address
  const onchainWallet = wallets.find(w => w.bitcoin_address);
  if (onchainWallet) {
    return {
      method: 'onchain',
      wallet_id: onchainWallet.id,
      onchain_address: onchainWallet.bitcoin_address!,
    };
  }

  logger.warn('Group wallets exist but none have payment addresses', { groupId });
  return null;
}
