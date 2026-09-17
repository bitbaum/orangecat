/**
 * AI Assistant Charging
 *
 * Wires user-created `ai_assistant` chat to the Cat Credits ledger:
 * a paid assistant debits the chatter's prepaid Cat Credits and credits the
 * creator's 95% share as spendable Cat Credits (platform keeps 5%).
 *
 * v1 scope: `free` (no charge) and `per_message` (full price, pre-authorized).
 * `per_token` / `subscription` are not metered yet → charge 0. The ledger is the
 * source of truth (append-only, atomic, overdraw-safe); `ai_assistants.total_revenue`
 * is a best-effort denormalized counter for creator stats.
 */

import { fromTable } from '@/lib/supabase/untyped';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCreditBalance, appendCreditEntry } from '@/services/cat/credits';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

/** The creator keeps the whole message price as spendable Cat Credits. The platform takes nothing. */
const CREATOR_SHARE = 1;

/**
 * A per-message charge above this is almost certainly a misconfigured / un-divided legacy
 * sats value sitting in a BTC column (the sats→BTC rename renamed the column but did NOT
 * divide by 1e8). Refuse to bill it rather than drain a user's balance.
 */
const SANE_MAX_CHARGE_BTC = 0.01;

/** Round to satoshi precision (the ledger column is numeric(18,8)). */
const roundBtc = (n: number): number => Math.round(n * 1e8) / 1e8;

export interface ChargeableAssistant {
  pricing_model: string;
  price_per_message: number | null;
}

/**
 * What the chatter owes the creator for one message, in BTC.
 * Free messages, free/per_token/subscription pricing, and misconfigured prices all → 0.
 */
export function computeCreatorChargeBtc(
  assistant: ChargeableAssistant,
  usesFreeMessage: boolean
): number {
  if (usesFreeMessage) {
    return 0;
  }
  // v1 meters per_message only; free / per_token / subscription cost nothing yet.
  if (assistant.pricing_model !== 'per_message') {
    return 0;
  }
  const price = Number(assistant.price_per_message ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    return 0;
  }
  if (price > SANE_MAX_CHARGE_BTC) {
    logger.warn(
      'AI assistant price_per_message exceeds sane max — skipping charge (likely misscaled legacy value)',
      { price },
      'AIAssistantCharge'
    );
    return 0;
  }
  return roundBtc(price);
}

/**
 * Does the payer have enough Cat Credits to cover `chargeBtc`?
 * Returns the balance so the caller can build an INSUFFICIENT_CREDITS response.
 */
export async function checkAffordability(
  admin: SupabaseClient,
  payerUserId: string,
  chargeBtc: number
): Promise<{ ok: true } | { ok: false; balance: number }> {
  const balance = await getCreditBalance(admin, payerUserId);
  return balance >= chargeBtc ? { ok: true } : { ok: false, balance };
}

/**
 * Settle a served message: debit the payer (authoritative, overdraw-safe, idempotent on the
 * message id) then credit the creator's share (best-effort, non-atomic in v1 — if the payout
 * append fails the platform simply retains the share, which is reconcilable from the ledger).
 */
export async function settleAssistantCharge(
  admin: SupabaseClient,
  args: {
    payerUserId: string;
    creatorUserId: string;
    assistantId: string;
    messageId: string;
    chargeBtc: number;
    model: string;
    totalTokens: number;
  }
): Promise<void> {
  const { payerUserId, creatorUserId, assistantId, messageId, chargeBtc, model, totalTokens } =
    args;

  // 1. Debit the payer. Idempotent on (kind, ref) = ('usage', messageId).
  // Post-serve settlement → allowOverdraw: the message is already served, so the
  // charge must land even into a negative balance. Affordability is only
  // pre-checked (checkAffordability), so N concurrent messages can all pass the
  // check and serve before any debit; without this they'd all serve free once
  // the balance couldn't cover them. Recording every charge drives the balance
  // negative and the next affordability check then blocks until top-up.
  const newBalance = await appendCreditEntry(admin, payerUserId, {
    kind: 'usage',
    amountBtc: -chargeBtc,
    ref: messageId,
    allowOverdraw: true,
    metadata: { assistantId, model, totalTokens },
  });
  if (newBalance === null) {
    // Balance was pre-checked, so this is a rare race (concurrent spend), a duplicate retry,
    // or a transient DB error. The message is already served; do NOT pay the creator if the
    // payer wasn't debited.
    logger.warn(
      'AI assistant charge debit returned null — message already served, creator not paid',
      { payerUserId, assistantId, messageId, chargeBtc },
      'AIAssistantCharge'
    );
    return;
  }

  // 2. Credit the creator's 95% share as spendable Cat Credits (best-effort).
  const creatorShare = roundBtc(chargeBtc * CREATOR_SHARE);
  if (creatorUserId && creatorUserId !== payerUserId && creatorShare > 0) {
    const credited = await appendCreditEntry(admin, creatorUserId, {
      kind: 'grant',
      amountBtc: creatorShare,
      ref: `${messageId}:creator`,
      metadata: { assistantId, source: 'assistant_revenue', grossBtc: chargeBtc },
    });
    if (credited === null) {
      logger.warn(
        'AI assistant creator payout failed — platform retains share (reconcilable from ledger)',
        { creatorUserId, assistantId, messageId, creatorShare },
        'AIAssistantCharge'
      );
    }
  }

  // 3. Bump the denormalized creator-revenue counter (best-effort; ledger remains the SSOT).
  await bumpAssistantRevenue(admin, assistantId, chargeBtc);
}

async function bumpAssistantRevenue(
  admin: SupabaseClient,
  assistantId: string,
  amountBtc: number
): Promise<void> {
  try {
    const { data } = await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
      .select('total_revenue')
      .eq('id', assistantId)
      .single();
    const nextRevenue = roundBtc(Number(data?.total_revenue ?? 0) + amountBtc);

    await fromTable(admin, DATABASE_TABLES.AI_ASSISTANTS)
      .update({ total_revenue: nextRevenue })
      .eq('id', assistantId);
  } catch (err) {
    logger.warn(
      'Failed to bump assistant revenue counter',
      { assistantId, err },
      'AIAssistantCharge'
    );
  }
}
