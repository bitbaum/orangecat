/**
 * One person's money picture: what came in, what is owed, what they said
 * about where their public money should go, and what the public would take.
 *
 * Reads only what already exists — settled payment intents, each valued at the
 * price recorded when it arrived (income), loan entities with a remaining
 * balance (debts), the civic split
 * (the declared split and the place) — and converts to the person's currency
 * server-side. Nothing here is a filing; the tax figure is an estimate and is
 * labelled as one wherever it is rendered.
 */
import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { taxTableFor } from '@/config/tax-estimates';
import { getCivicSplit, type CivicSplit } from '@/domain/civic-split/service';
import { estimateIncomeTax, type TaxEstimate } from '@/domain/finances/tax';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { convertBtcToOrNull } from '@/services/currency/rates.server';

export const INCOME_WINDOW_DAYS = 365;

export interface IncomeSummary {
  windowDays: number;
  /** Settled payments counted — each sale once. */
  payments: number;
  totalBtc: number;
  /**
   * In the display currency, each payment at the price when IT arrived. Null
   * when some payment has no recorded price and no current rate exists either.
   */
  total: number | null;
  /**
   * Payments with no price recorded at arrival, valued at today's rate instead.
   * 0 means every figure is as received; anything else must be SAID.
   */
  valuedAtToday: number;
}

export interface Debt {
  id: string;
  title: string;
  remaining: number;
  currency: string;
  monthlyPayment: number | null;
  lender: string | null;
  href: string;
}

export interface PersonalFinances {
  currency: string;
  income: IncomeSummary;
  debts: Debt[];
  civicSplit: CivicSplit | null;
  /** Null when there is no declared place or no table for it. */
  tax: TaxEstimate | null;
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function incomeOf(
  supabase: AnySupabaseClient,
  userId: string,
  currency: string
): Promise<IncomeSummary> {
  // Every inflow is a payment intent — purchases, support, tips, requests — so
  // intents ARE the income. Paid orders are not added on top: a purchase writes
  // both an intent and an order and settlement marks both paid, so summing the
  // two counted every sale twice, and the tax estimate built on it with it.
  // Windowed on paid_at: income belongs to the day it arrived.
  const { data } = await supabase
    .from(DATABASE_TABLES.PAYMENT_INTENTS)
    .select('amount_btc, rates_at_paid')
    .eq('seller_id', userId)
    .eq('status', STATUS.PAYMENT_INTENTS.PAID)
    .gte('paid_at', sinceIso(INCOME_WINDOW_DAYS))
    .limit(1000);
  const rows = (data as IncomeRow[] | null) ?? [];
  const valued = valueIncome(rows, currency);
  const today = valued.unvaluedBtc > 0 ? await convertBtcToOrNull(valued.unvaluedBtc, currency) : 0;
  return {
    windowDays: INCOME_WINDOW_DAYS,
    payments: rows.length,
    totalBtc: valued.totalBtc,
    // A figure that silently omitted some payments would understate income;
    // when today's rate is missing too, there is no honest total to give.
    total: today === null ? null : valued.atReceipt + today,
    valuedAtToday: valued.unvaluedCount,
  };
}

export interface IncomeRow {
  amount_btc: number | null;
  rates_at_paid: Record<string, number> | null;
}

/**
 * Value each payment at the price recorded when it arrived. Pure: payments with
 * no recorded price for `currency` are returned unvalued (with their count) for
 * the caller to price at today's rate — and to say that it did.
 */
export function valueIncome(
  rows: readonly IncomeRow[],
  currency: string
): { totalBtc: number; atReceipt: number; unvaluedBtc: number; unvaluedCount: number } {
  const code = currency.toUpperCase();
  let totalBtc = 0;
  let atReceipt = 0;
  let unvaluedBtc = 0;
  let unvaluedCount = 0;
  for (const row of rows) {
    const btc = row.amount_btc ?? 0;
    totalBtc += btc;
    // BTC and sats are not priced: their "value at receipt" is the amount.
    if (code === 'BTC' || code === 'SATS') {
      continue;
    }
    const rate = row.rates_at_paid?.[code];
    if (typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
      atReceipt += btc * rate;
    } else {
      unvaluedBtc += btc;
      unvaluedCount += 1;
    }
  }
  if (code === 'BTC' || code === 'SATS') {
    // Exact, no rate involved: hand the whole amount to the caller's converter.
    return { totalBtc, atReceipt: 0, unvaluedBtc: totalBtc, unvaluedCount: 0 };
  }
  return { totalBtc, atReceipt, unvaluedBtc, unvaluedCount };
}

async function debtsOf(supabase: AnySupabaseClient, actorIds: string[]): Promise<Debt[]> {
  if (actorIds.length === 0) {
    return [];
  }
  const meta = ENTITY_REGISTRY.loan;
  const { data } = await supabase
    .from(meta.tableName)
    .select('id, title, remaining_balance, currency, monthly_payment, current_lender, paid_off_at')
    .in('actor_id', actorIds)
    .is('paid_off_at', null)
    .gt('remaining_balance', 0)
    .order('remaining_balance', { ascending: false })
    .limit(50);
  return (
    (data as Array<{
      id: string;
      title: string;
      remaining_balance: number;
      currency: string | null;
      monthly_payment: number | null;
      current_lender: string | null;
    }> | null) ?? []
  ).map(row => ({
    id: row.id,
    title: row.title,
    remaining: row.remaining_balance,
    currency: row.currency ?? 'CHF',
    monthlyPayment: row.monthly_payment,
    lender: row.current_lender,
    href: meta.detailPath ? meta.detailPath(row.id) : meta.basePath,
  }));
}

export async function getPersonalFinances(
  supabase: AnySupabaseClient,
  userId: string,
  actorIds: string[],
  currency = 'CHF'
): Promise<PersonalFinances> {
  const primaryActor = actorIds[0];
  const [income, debts, civicSplit] = await Promise.all([
    incomeOf(supabase, userId, currency),
    debtsOf(supabase, actorIds),
    primaryActor ? getCivicSplit(supabase, primaryActor) : Promise.resolve(null),
  ]);
  const table = civicSplit ? taxTableFor(civicSplit) : null;
  const tax =
    table && income.total !== null && currency === table.currency
      ? estimateIncomeTax(income.total, table)
      : null;
  return { currency, income, debts, civicSplit, tax };
}
