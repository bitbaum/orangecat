/**
 * Capital in the open: what a stranger sees on each rail. Figures come from
 * the ledger, an unreadable or private rail reads closed, and a fiat figure
 * with no rate behind it is null — never a confident zero.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const stats = vi.fn();
const toFiat = vi.fn();
vi.mock('@/services/wallets/funding-stats', () => ({
  getEntityFundingStats: (...a: unknown[]) => stats(...a),
}));
vi.mock('@/services/currency/rates.server', () => ({
  convertBtcToOrNull: (...a: unknown[]) => toFiat(...a),
}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: () => {
    throw new Error('no env in tests');
  },
}));

import { loadOpenCapital } from '@/services/capital/open-capital';
import { CAPITAL } from '@/config/capital';
import { getTableName } from '@/config/entity-registry';

const PROJECTS = getTableName('project');
const INVESTMENTS = getTableName('investment');

type Row = Record<string, unknown>;

/** A Supabase double: rows by table, filtered by the .eq() calls made. */
function fakeClient(rows: Record<string, Row[]>) {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      const q = {
        select: () => q,
        eq: (col: string, val: unknown) => {
          filters.push([col, val]);
          return q;
        },
        maybeSingle: async () => ({
          data: (rows[table] ?? []).find(r => filters.every(([c, v]) => r[c] === v)) ?? null,
          error: null,
        }),
      };
      return q;
    },
  } as never;
}

beforeEach(() => {
  stats.mockReset();
  toFiat.mockReset();
});

describe('loadOpenCapital', () => {
  it('reads the fund and invest rails live and reports the absent loan as closed', async () => {
    const loki = CAPITAL.loki;
    stats.mockImplementation(async (_s, type: string) =>
      type === 'project'
        ? { totalBtc: 0.01, contributorCount: 3, namedSupporterCount: 2 }
        : { totalBtc: 0.002, contributorCount: 1, namedSupporterCount: 1 }
    );
    toFiat.mockImplementation(async (btc: number, cur: string) =>
      cur === 'BTC' ? btc : btc * 80_000
    );

    const capital = await loadOpenCapital(
      'loki',
      fakeClient({
        [PROJECTS]: [
          {
            id: loki.projectId,
            status: 'active',
            title: 'Loki',
            currency: 'CHF',
            goal_amount: 5000,
          },
        ],
        [INVESTMENTS]: [
          {
            id: loki.investmentId,
            status: 'active',
            title: 'Loki revenue share',
            currency: 'BTC',
            target_amount: '1',
            minimum_investment: 0.001,
            investment_type: 'revenue_share',
            expected_return_rate: 8,
            term_months: 36,
          },
        ],
      })
    );

    expect(capital?.rails.fund).toMatchObject({
      open: true,
      currency: 'CHF',
      target: 5000,
      raised: 800,
      backers: 3,
      path: `/projects/${loki.projectId}`,
    });
    expect(capital?.rails.invest).toMatchObject({
      open: true,
      target: 1,
      raised: 0.002,
      minimum: 0.001,
      kindLabel: 'Revenue Share',
      ratePercent: 8,
      termMonths: 36,
    });
    expect(capital?.rails.lend).toEqual({ rail: 'lend', open: false });
  });

  it('says nothing about fiat it cannot price', async () => {
    stats.mockResolvedValue({ totalBtc: 0.5, contributorCount: 2, namedSupporterCount: 2 });
    toFiat.mockResolvedValue(null);
    const capital = await loadOpenCapital(
      'orangecat',
      fakeClient({
        [PROJECTS]: [
          { id: CAPITAL.orangecat.projectId, status: 'active', currency: 'CHF', goal_amount: 1200 },
        ],
      })
    );
    expect(capital?.rails.fund).toMatchObject({ open: true, raised: null, backers: 2 });
  });

  it('treats a draft (not publicly visible) project as closed', async () => {
    stats.mockResolvedValue(null);
    const capital = await loadOpenCapital(
      'orangecat',
      fakeClient({ [PROJECTS]: [{ id: CAPITAL.orangecat.projectId, status: 'draft' }] })
    );
    expect(capital?.rails.fund.open).toBe(false);
    expect(stats).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when no public client can be made', async () => {
    await expect(loadOpenCapital('orangecat')).resolves.toBeNull();
  });
});
