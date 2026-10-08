/**
 * Money routes — a person's own rule for where money paid to them lands.
 *
 * Reads the rule (money_routes) and what has already landed (settled payment
 * intents, with the price each was worth on arrival), and hands both to the
 * pure decision in ./routing. Writes replace the rule as one ordered list.
 *
 * Read paths run on whichever client the caller holds: the owner's session
 * (RLS limits it to their own rows) or the server's, when a payer's request
 * resolves where to send money. The rule is never shown to a payer — only the
 * wallet it chose, exactly as any wallet was shown before.
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getRenderRates } from '@/services/currency/rates.server';
import { logger } from '@/utils/logger';
import { toBps, type MoneyRulesInput } from './schema';
import {
  chooseRoutedWallet,
  lineProgress,
  type LineProgress,
  type RouteLine,
  type RoutedPayment,
} from './routing';

interface RouteRow {
  wallet_id: string;
  kind: RouteLine['kind'];
  share_bps: number | null;
  target_amount: number | string | null;
  target_currency: string | null;
  period: RouteLine['period'];
  starts_at: string;
}

function toLine(row: RouteRow): RouteLine {
  return {
    walletId: row.wallet_id,
    kind: row.kind,
    shareBps: row.share_bps,
    // numeric arrives as a string from PostgREST.
    targetAmount: row.target_amount === null ? null : Number(row.target_amount),
    targetCurrency: row.target_currency,
    period: row.period,
    startsAt: row.starts_at,
  };
}

export async function loadRouteLines(
  client: AnySupabaseClient,
  profileId: string
): Promise<RouteLine[]> {
  const { data, error } = await client
    .from(DATABASE_TABLES.MONEY_ROUTES)
    .select('wallet_id, kind, share_bps, target_amount, target_currency, period, starts_at')
    .eq('profile_id', profileId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`money routes: ${error.message}`);
  }
  return ((data as RouteRow[] | null) ?? []).map(toLine);
}

/**
 * Settled payments to this person since the rule's earliest line began, into
 * any of their personal wallets — "everything that comes in" for a share.
 */
export async function loadRoutedPayments(
  client: AnySupabaseClient,
  profileId: string,
  personalWalletIds: readonly string[],
  since: string
): Promise<RoutedPayment[]> {
  if (personalWalletIds.length === 0) {
    return [];
  }
  const { data, error } = await client
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('receiving_wallet_id, amount_btc, rates_at_paid, paid_at')
    .eq('seller_id', profileId)
    .eq('status', STATUS.PAYMENT_INTENTS.PAID)
    .in('receiving_wallet_id', [...personalWalletIds])
    .gte('paid_at', since)
    .limit(5000);
  if (error) {
    throw new Error(`money routes payments: ${error.message}`);
  }
  return (
    (data as Array<{
      receiving_wallet_id: string;
      amount_btc: number | string;
      rates_at_paid: Record<string, number> | null;
      paid_at: string;
    }> | null) ?? []
  ).map(r => ({
    walletId: r.receiving_wallet_id,
    amountBtc: Number(r.amount_btc),
    ratesAtPaid: r.rates_at_paid,
    paidAt: r.paid_at,
  }));
}

/** Today's prices without touching the network — routing sits on a payment path. */
function todayRates(): Record<string, number> {
  return { ...(getRenderRates()?.rates ?? {}) };
}

function earliestStart(lines: readonly RouteLine[]): string {
  return lines.reduce((min, l) => (l.startsAt < min ? l.startsAt : min), lines[0]!.startsAt);
}

/**
 * The wallet a payment to this person should land in under their rule, or null
 * when they have no rule, every line is satisfied, or the rule cannot be read.
 *
 * Never throws: a broken rule must not make a person unpayable. The caller
 * falls back to the usual choice on null.
 */
export async function routedWalletId(
  client: AnySupabaseClient,
  profileId: string,
  personalWalletIds: readonly string[]
): Promise<string | null> {
  try {
    const lines = (await loadRouteLines(client, profileId)).filter(l =>
      personalWalletIds.includes(l.walletId)
    );
    if (lines.length === 0) {
      return null;
    }
    const payments = await loadRoutedPayments(
      client,
      profileId,
      personalWalletIds,
      earliestStart(lines)
    );
    return chooseRoutedWallet(lines, payments, new Date(), todayRates());
  } catch (error) {
    logger.warn(
      'Money routes unreadable; using the usual wallet',
      { profileId, error },
      'MoneyRoutes'
    );
    return null;
  }
}

export interface RouteView extends RouteLine {
  progress: LineProgress;
}

/** The owner's rule with each line's progress, and where the next payment goes. */
export async function getRouteOverview(
  client: AnySupabaseClient,
  profileId: string,
  personalWalletIds: readonly string[]
): Promise<{ lines: RouteView[]; next: string | null }> {
  const lines = await loadRouteLines(client, profileId);
  if (lines.length === 0) {
    return { lines: [], next: null };
  }
  const payments = await loadRoutedPayments(
    client,
    profileId,
    personalWalletIds,
    earliestStart(lines)
  );
  const now = new Date();
  const rates = todayRates();
  const live = lines.filter(l => personalWalletIds.includes(l.walletId));
  return {
    lines: lines.map(l => ({ ...l, progress: lineProgress(l, payments, now, rates) })),
    next: chooseRoutedWallet(live, payments, now, rates),
  };
}

/**
 * Replace the owner's rule with `input`, in order.
 *
 * A wallet that stays in the rule KEEPS its start — so reordering the list, or
 * correcting a debt's amount, never resets what has already landed there.
 * `starts_at` is never sent: an update leaves it alone, an insert takes now().
 * Runs on the owner's session, so RLS checks the row AND that every wallet
 * named is theirs.
 */
export async function saveMoneyRules(
  client: AnySupabaseClient,
  profileId: string,
  input: MoneyRulesInput
): Promise<void> {
  const { data: existing, error: readError } = await client
    .from(DATABASE_TABLES.MONEY_ROUTES)
    .select('wallet_id')
    .eq('profile_id', profileId);
  if (readError) {
    throw new Error(`money routes: ${readError.message}`);
  }

  const kept = new Set(input.lines.map(l => l.walletId));
  const dropped = ((existing as Array<{ wallet_id: string }> | null) ?? [])
    .map(r => r.wallet_id)
    .filter(id => !kept.has(id));
  if (dropped.length > 0) {
    const { error } = await client
      .from(DATABASE_TABLES.MONEY_ROUTES)
      .delete()
      .eq('profile_id', profileId)
      .in('wallet_id', dropped);
    if (error) {
      throw new Error(`money routes: ${error.message}`);
    }
  }

  if (input.lines.length === 0) {
    return;
  }
  const rows = input.lines.map((line, position) => ({
    profile_id: profileId,
    wallet_id: line.walletId,
    position,
    kind: line.kind,
    share_bps: line.kind === 'share' ? toBps(line.sharePercent) : null,
    target_amount: line.kind === 'fill' ? line.targetAmount : null,
    target_currency: line.kind === 'fill' ? line.targetCurrency : null,
    period: line.kind === 'fill' ? line.period : 'once',
  }));
  const { error } = await client
    .from(DATABASE_TABLES.MONEY_ROUTES)
    .upsert(rows, { onConflict: 'profile_id,wallet_id' });
  if (error) {
    throw new Error(`money routes: ${error.message}`);
  }
}
