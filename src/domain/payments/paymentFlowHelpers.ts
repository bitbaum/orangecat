/**
 * Payment Flow — Shared Internal Helpers
 *
 * Small building blocks used across initiation, status polling, and
 * settlement. Extracted from paymentFlowService.ts (pure move).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { getAdminClient } from '@/lib/supabase/admin';
import { convertToBtcOrNull } from '@/services/currency/rates.server';
import type { PaymentIntentStatus } from './types';
import { logger } from '@/utils/logger';

export const METHOD_LABELS: Record<string, string> = {
  nwc: 'Lightning',
  lightning_address: 'Lightning',
  onchain: 'On-chain Bitcoin',
};

/** SSOT for public status-token hashing — also consumed by the L402 surface. */
export function hashPublicStatusToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function resolveAmount(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string,
  inputAmount?: number
): Promise<number> {
  const meta = getEntityMetadata(entityType);

  if (meta.paymentPattern === 'contribution') {
    // Contributions: amount must be provided by buyer
    if (!inputAmount || inputAmount <= 0) {
      throw new Error('Amount is required for contributions');
    }
    return inputAmount;
  }

  // Fixed price: read the entity's price (stored in its OWN currency, NOT BTC —
  // there is no price_btc column; reading it threw "Entity has no price set" on
  // every fixed-price checkout) and convert to BTC for the invoice. The price
  // column differs by entity: products use `price`, services use `fixed_price`.
  // We convert via the same rate path the UI uses to DISPLAY prices, so the
  // amount charged matches what the buyer was shown.
  const admin = getAdminClient() as unknown as SupabaseClient;
  // Price column is declared per entity in the registry (SSOT). Defaults to
  // `price` for entities that don't override it (e.g. products).
  const priceColumn = meta.priceColumn ?? 'price';
  const { data: entity } = await admin
    .from(meta.tableName)
    .select(`${priceColumn}, currency`)
    .eq('id', entityId)
    .single();

  // Dynamic select column widens the PostgREST result type — read via unknown.
  const row = entity as unknown as Record<string, unknown> | null;
  const rawPrice = row ? row[priceColumn] : null;
  const priceNum = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice);
  if (!priceNum || priceNum <= 0) {
    throw new Error('Entity has no price set');
  }

  const currency = String(row?.currency || 'BTC').toUpperCase();
  if (currency === 'BTC') {
    return priceNum;
  }

  // Refuse rather than guess. This converts a seller's asking price into the
  // Bitcoin a buyer will actually part with, so an approximate rate is not a
  // cosmetic problem — it is charging the wrong amount. The old code fell back
  // to a hardcoded 86,000 CHF/BTC that had drifted ~65% from the market, which
  // would have invoiced a CHF 100 listing at roughly CHF 61 worth of Bitcoin,
  // every time, with no error and nothing on screen to notice.
  const amountBtc = await convertToBtcOrNull(priceNum, currency);
  if (amountBtc === null || !(amountBtc > 0)) {
    throw new Error(
      `Bitcoin exchange rate unavailable for ${currency}; refusing to price this payment`
    );
  }
  return amountBtc;
}

export async function getEntityTitle(
  supabase: SupabaseClient,
  entityType: EntityType,
  entityId: string
): Promise<string> {
  // Use admin to bypass RLS — entity title is needed for invoice description
  // Cast to untyped client — queries use dynamic column names from entity registry.
  const admin = getAdminClient() as unknown as SupabaseClient;
  const meta = getEntityMetadata(entityType);
  const titleColumn = meta.titleColumn ?? 'title';
  const { data } = await admin.from(meta.tableName).select(titleColumn).eq('id', entityId).single();

  const row = data as unknown as Record<string, unknown> | null;
  const title = row?.[titleColumn];
  return typeof title === 'string' && title.trim()
    ? title
    : `${meta.name} #${entityId.slice(0, 8)}`;
}

export async function updatePaymentStatus(
  paymentIntentId: string,
  status: PaymentIntentStatus
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (status === 'paid') {
    updates.paid_at = new Date().toISOString();
  }

  // Always write through the admin client. A status transition is a system fact
  // recorded AFTER the caller was authorized — but RLS only grants UPDATE on
  // payment_intents to the buyer, so a seller- (or anon-) scoped client updates
  // zero rows with NO error, and the intent silently stays in its old status
  // while the caller reports success.
  const admin = getAdminClient() as unknown as SupabaseClient;
  const { error } = await admin
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .update(updates)
    .eq('id', paymentIntentId);

  // A swallowed error here leaves the payment intent in a stale status while the
  // caller reports success — money state diverging from reality. Surface it.
  if (error) {
    logger.error('Failed to update payment intent status', { paymentIntentId, status, error });
    throw new Error('Failed to update payment status');
  }
}
