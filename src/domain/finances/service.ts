/**
 * One person's money picture: what came in, what is owed, what they said
 * about where their public money should go, and what the public would take.
 *
 * Reads only what already exists — paid orders and settled payment intents
 * (income), loan entities with a remaining balance (debts), the civic split
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
  paidOrders: number;
  settledPayments: number;
  totalBtc: number;
  /** In the display currency, or null when no rate is available. */
  total: number | null;
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
  const since = sinceIso(INCOME_WINDOW_DAYS);
  const [orders, intents] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.ORDERS)
      .select('amount_btc')
      .eq('seller_id', userId)
      .eq('status', STATUS.ORDERS.PAID)
      .gte('created_at', since)
      .limit(1000),
    supabase
      .from(DATABASE_TABLES.PAYMENT_INTENTS)
      .select('amount_btc')
      .eq('seller_id', userId)
      .eq('status', STATUS.PAYMENT_INTENTS.PAID)
      .gte('created_at', since)
      .limit(1000),
  ]);
  const sum = (rows: unknown) =>
    ((rows as Array<{ amount_btc: number | null }> | null) ?? []).reduce(
      (n, r) => n + (r.amount_btc ?? 0),
      0
    );
  const totalBtc = sum(orders.data) + sum(intents.data);
  return {
    windowDays: INCOME_WINDOW_DAYS,
    paidOrders: orders.data?.length ?? 0,
    settledPayments: intents.data?.length ?? 0,
    totalBtc,
    total: totalBtc > 0 ? await convertBtcToOrNull(totalBtc, currency) : 0,
  };
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
