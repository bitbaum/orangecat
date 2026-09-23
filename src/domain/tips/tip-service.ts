/**
 * Tip service — resolve a person by username and mint a non-custodial Bitcoin
 * tip against THEIR own wallet. A tip is a first-class payment_intent
 * (intent_kind='tip'): it reuses the payment stack's wallet resolution, invoice
 * generation, status polling AND settle path (SSOT), so it pays exactly like any
 * other payment — NWC > Lightning address > on-chain, zero fee, OrangeCat never
 * in the money path — and the recipient gets the standard "you got paid"
 * notification for free when it settles.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getAdminClient } from '@/lib/supabase/admin';
import { fromTable } from '@/lib/supabase/untyped';
import { NotificationDispatcher } from '@/services/notifications/dispatcher';
import { ROUTES } from '@/config/routes';
import { resolveUserWallet } from '@/domain/payments/walletResolutionService';
import {
  initiateTip as initiateTipPayment,
  checkPublicPaymentStatus,
} from '@/domain/payments/paymentFlowService';
import { METHOD_LABELS } from '@/domain/payments/paymentFlowHelpers';
import type { ResolvedWallet } from '@/domain/payments/types';
import { logger } from '@/utils/logger';

/**
 * Resolve the recipient's receiving wallet with the service-role client — same
 * as the public-support flow. This keeps tips working WITHOUT depending on
 * wallet rows being anon-readable (so `wallets_select` RLS can be tightened),
 * and it decrypts the NWC URI server-side only.
 */
function resolveRecipientWallet(userId: string): Promise<ResolvedWallet | null> {
  return resolveUserWallet(getAdminClient() as unknown as SupabaseClient, userId);
}

interface TipRecipient {
  userId: string;
  username: string;
  displayName: string;
}

async function resolveRecipient(
  supabase: AnySupabaseClient,
  username: string
): Promise<TipRecipient | null> {
  const { data } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('id, username, display_name:name')
    .eq('username', username)
    .maybeSingle();

  const row = data as { id?: string; username?: string; display_name?: string } | null;
  if (!row?.id || !row.username) {
    return null;
  }
  return { userId: row.id, username: row.username, displayName: row.display_name || row.username };
}

export interface TipReceiveInfo {
  canReceive: boolean;
  recipientName: string;
  methodLabel?: string;
}

/**
 * Growth loop: a visitor opened the tip dialog for someone who can't receive
 * yet. Tell the would-be recipient — this is the strongest possible nudge to
 * set up receiving ("someone literally tried to pay you"). Deduped to at most
 * one notification per recipient per window so an enumeration crawl (or an
 * eager fan) can't spam them. Fire-and-forget: never blocks or fails the
 * public receive-info request.
 */
const TIP_DEAD_END_DEDUP_DAYS = 7;

async function notifyTipDeadEnd(userId: string): Promise<void> {
  try {
    const admin = getAdminClient();
    const since = new Date(
      Date.now() - TIP_DEAD_END_DEDUP_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const { data: recent } = await fromTable(admin, DATABASE_TABLES.NOTIFICATIONS)
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'tip_dead_end')
      .gte('created_at', since)
      .limit(1);
    if (recent && recent.length > 0) {
      return;
    }

    await NotificationDispatcher.dispatch({
      userId,
      type: 'tip_dead_end',
      title: 'Someone tried to tip you Bitcoin',
      message:
        "A visitor wanted to send you a Bitcoin tip, but you don't have a wallet that can receive yet. Add one to start receiving — it takes about a minute.",
      actionUrl: ROUTES.DASHBOARD.WALLETS,
    });
  } catch (err) {
    logger.warn('Failed to send tip dead-end notification', { err: String(err), userId }, 'Tips');
  }
}

/** Public, secret-free: can this person receive tips, and via what rail. */
export async function getTipReceiveInfo(
  supabase: AnySupabaseClient,
  username: string
): Promise<TipReceiveInfo | null> {
  const recipient = await resolveRecipient(supabase, username);
  if (!recipient) {
    return null;
  }
  const wallet = await resolveRecipientWallet(recipient.userId);
  if (!wallet) {
    // Someone is looking at this person's tip dialog and hitting a dead end —
    // notify them (deduped) so a lost tip becomes an activation nudge.
    void notifyTipDeadEnd(recipient.userId);
  }
  return {
    canReceive: !!wallet,
    recipientName: recipient.displayName,
    methodLabel: wallet ? METHOD_LABELS[wallet.method] : undefined,
  };
}

export interface TipInvoice {
  /** payment_intents row id — the tipper polls status with this + statusToken. */
  intentId: string;
  /** Opaque bearer token to poll settlement without an account. */
  statusToken: string;
  qrData: string;
  methodLabel: string;
  recipientName: string;
  amountBtc: number;
  expiresInSeconds: number | null;
}

type TipInvoiceResult = { ok: true; invoice: TipInvoice } | { ok: false; error: string };

/**
 * Mint a tip payment request for `amountBtc` to the recipient's own wallet.
 * Persists an entity-less payment_intent so the payment can be tracked, the
 * tipper shown live confirmation, and the recipient notified on settlement.
 */
export async function initiateTip(
  supabase: AnySupabaseClient,
  username: string,
  amountBtc: number
): Promise<TipInvoiceResult> {
  const recipient = await resolveRecipient(supabase, username);
  if (!recipient) {
    return { ok: false, error: 'That person could not be found.' };
  }

  const wallet = await resolveRecipientWallet(recipient.userId);
  if (!wallet) {
    return {
      ok: false,
      error: `${recipient.displayName} hasn't set up a wallet to receive Bitcoin tips yet.`,
    };
  }

  try {
    const res = await initiateTipPayment({
      recipientUserId: recipient.userId,
      recipientName: recipient.displayName,
      wallet,
      amountBtc,
    });
    return {
      ok: true,
      invoice: {
        intentId: res.payment_intent.id,
        statusToken: res.status_token,
        qrData: res.qr_data,
        methodLabel: res.method_label,
        recipientName: recipient.displayName,
        amountBtc,
        expiresInSeconds: res.expires_in_seconds,
      },
    };
  } catch (err) {
    logger.error('Failed to initiate tip', { err: String(err), username }, 'Tips');
    return { ok: false, error: 'Could not create a tip request right now. Please try again.' };
  }
}

export type TipStatus = 'pending' | 'paid' | 'expired' | 'failed';

export interface TipStatusResult {
  status: TipStatus;
  paidAt: string | null;
}

/**
 * Poll a tip's settlement using its bearer token. Wraps the generic public
 * payment-status check (NWC lookup / LUD-21 verify / on-chain), collapsing the
 * intent's status vocabulary to what the tip UI needs.
 */
export async function getTipStatus(intentId: string, token: string): Promise<TipStatusResult> {
  const res = await checkPublicPaymentStatus(intentId, token);
  const status: TipStatus =
    res.status === 'paid'
      ? 'paid'
      : res.status === 'expired'
        ? 'expired'
        : res.status === 'failed'
          ? 'failed'
          : 'pending';
  return { status, paidAt: res.paid_at ?? null };
}
