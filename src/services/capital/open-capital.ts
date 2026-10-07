/**
 * Capital in the open — the live, public state of a product's three rails.
 *
 * Every figure here is read through a SESSIONLESS client, so row-level
 * security decides what can be shown exactly as it would for a stranger: a
 * draft project, a private loan or an unlisted offering simply reads as "not
 * open". Raised amounts come from the settled contributions ledger
 * (getEntityFundingStats), never from a cached column, and a fiat figure with
 * no Bitcoin rate behind it is null rather than a confident zero.
 */

import { CAPITAL, type CapitalSlug } from '@/config/capital';
import { getTableName } from '@/config/entity-registry';
import { ENTITY_STATUS } from '@/config/database-constants';
import { INVESTMENT_PUBLIC_STATUSES, INVESTMENT_TYPE_LABELS } from '@/config/investments';
import { ROUTES } from '@/config/routes';
import { applyVisibility, type VisibilityFilter } from '@/lib/entities/visibility';
import { createPublicClient } from '@/lib/supabase/public';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { convertBtcToOrNull } from '@/services/currency/rates.server';
import { getEntityFundingStats } from '@/services/wallets/funding-stats';
import { logger } from '@/utils/logger';

export type CapitalRailKind = 'fund' | 'lend' | 'invest';

interface RailBase {
  rail: CapitalRailKind;
}

export interface OpenRail extends RailBase {
  open: true;
  title: string;
  /** Path on OrangeCat (relative) where the reader acts on it. */
  path: string;
  currency: string;
  /** The goal, the loan amount, or the offering's target — in `currency`. */
  target: number | null;
  /** Settled, in `currency`. Null when no rate is available to say. */
  raised: number | null;
  backers: number;
  /** Investment: the smallest ticket, in `currency`. */
  minimum: number | null;
  /** Investment: expected return; loan: interest — percent a year. */
  ratePercent: number | null;
  termMonths: number | null;
  /** Investment: "Revenue Share", "Equity", … from config. */
  kindLabel: string | null;
  riskLevel: string | null;
}

export interface ClosedRail extends RailBase {
  open: false;
}

export type CapitalRail = OpenRail | ClosedRail;

export interface OpenCapital {
  slug: CapitalSlug;
  title: string;
  rails: { fund: CapitalRail; lend: CapitalRail; invest: CapitalRail };
}

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

async function readPublicRow(
  supabase: AnySupabaseClient,
  table: string,
  id: string,
  visibility: VisibilityFilter
): Promise<Row | null> {
  const { data, error } = await applyVisibility(
    supabase.from(table).select('*').eq('id', id),
    visibility
  ).maybeSingle();
  if (error) {
    logger.warn('Capital rail unreadable', { table, id, error }, 'Capital');
    return null;
  }
  return (data as Row | null) ?? null;
}

/** Settled money for an entity, in its own currency (null = no rate to say). */
async function raisedIn(
  supabase: AnySupabaseClient,
  type: 'project' | 'investment',
  id: string,
  currency: string
): Promise<{ raised: number | null; backers: number }> {
  const stats = await getEntityFundingStats(supabase, type, id);
  const btc = stats?.totalBtc ?? 0;
  return {
    raised: btc > 0 ? await convertBtcToOrNull(btc, currency) : 0,
    backers: stats?.contributorCount ?? 0,
  };
}

const closed = (rail: CapitalRailKind): ClosedRail => ({ rail, open: false });

async function fundRail(supabase: AnySupabaseClient, id: string): Promise<CapitalRail> {
  const row = await readPublicRow(supabase, getTableName('project'), id, {
    column: 'status',
    value: ENTITY_STATUS.ACTIVE,
  });
  if (!row) {
    return closed('fund');
  }
  const currency = String(row.currency || 'BTC').toUpperCase();
  const { raised, backers } = await raisedIn(supabase, 'project', id, currency);
  return {
    rail: 'fund',
    open: true,
    title: String(row.title ?? ''),
    path: ROUTES.PROJECTS.VIEW(id),
    currency,
    target: num(row.goal_amount),
    raised,
    backers,
    minimum: null,
    ratePercent: null,
    termMonths: null,
    kindLabel: null,
    riskLevel: null,
  };
}

async function lendRail(supabase: AnySupabaseClient, id: string | null): Promise<CapitalRail> {
  if (!id) {
    return closed('lend');
  }
  const row = await readPublicRow(supabase, getTableName('loan'), id, {
    column: 'is_public',
    value: true,
  });
  if (!row) {
    return closed('lend');
  }
  return {
    rail: 'lend',
    open: true,
    title: String(row.title ?? ''),
    path: ROUTES.LOANS.VIEW(id),
    currency: String(row.currency || 'BTC').toUpperCase(),
    target: num(row.original_amount),
    // Lenders settle off-platform today (fulfillment_type manual), so the
    // record holds no "lent so far" figure — left unsaid rather than guessed.
    raised: null,
    backers: 0,
    minimum: null,
    ratePercent: num(row.interest_rate),
    termMonths: num(row.term_months),
    kindLabel: null,
    riskLevel: null,
  };
}

async function investRail(supabase: AnySupabaseClient, id: string | null): Promise<CapitalRail> {
  if (!id) {
    return closed('invest');
  }
  const row = await readPublicRow(supabase, getTableName('investment'), id, {
    column: 'status',
    value: INVESTMENT_PUBLIC_STATUSES,
  });
  if (!row) {
    return closed('invest');
  }
  const currency = String(row.currency || 'BTC').toUpperCase();
  const { raised, backers } = await raisedIn(supabase, 'investment', id, currency);
  const type = typeof row.investment_type === 'string' ? row.investment_type : null;
  return {
    rail: 'invest',
    open: true,
    title: String(row.title ?? ''),
    path: ROUTES.INVESTMENTS.VIEW(id),
    currency,
    target: num(row.target_amount),
    raised,
    backers,
    minimum: num(row.minimum_investment),
    ratePercent: num(row.expected_return_rate),
    termMonths: num(row.term_months),
    kindLabel: type ? (INVESTMENT_TYPE_LABELS[type] ?? type) : null,
    riskLevel: typeof row.risk_level === 'string' ? row.risk_level : null,
  };
}

/**
 * The three rails for a product. Never throws: an unreadable rail is reported
 * closed, and a missing Supabase configuration yields null for the whole set.
 */
export async function loadOpenCapital(
  slug: CapitalSlug,
  supabase?: AnySupabaseClient
): Promise<OpenCapital | null> {
  let client: AnySupabaseClient;
  try {
    client = supabase ?? createPublicClient();
  } catch (error) {
    logger.warn('Capital: no public Supabase client', { error }, 'Capital');
    return null;
  }
  const config = CAPITAL[slug];
  const [fund, lend, invest] = await Promise.all([
    fundRail(client, config.projectId),
    lendRail(client, config.loanId),
    investRail(client, config.investmentId),
  ]);
  return { slug, title: config.title, rails: { fund, lend, invest } };
}
