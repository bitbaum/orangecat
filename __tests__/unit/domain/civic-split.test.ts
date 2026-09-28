/**
 * The civic split's invariants, pinned:
 *  - three shares always sum to 100, however a slider or a sentence moves them;
 *  - the public aggregate never reports a place with fewer people than the
 *    minimum group, and its published means still sum to 100;
 *  - the caveat is not optional copy — every surface that shows a split
 *    carries it, because the difference between "where I stand" and "what I
 *    owe" is the whole feature.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CIVIC_LEVEL_IDS,
  CIVIC_SPLIT_CAVEAT,
  CIVIC_SPLIT_DEFAULT,
  CIVIC_SPLIT_MIN_GROUP,
} from '@/config/civic-split';
import {
  civicSplitInputSchema,
  rebalanceShares,
  sharesSumToTotal,
  type CivicShares,
} from '@/domain/civic-split/schema';
import { roundToTotal, summarizeByPlace } from '@/domain/civic-split/service';
import { mergeShares } from '@/services/cat/handlers/civic-split';

const sum = (s: CivicShares) => CIVIC_LEVEL_IDS.reduce((n, id) => n + s[id], 0);

describe('shares always sum to 100', () => {
  it('the default does', () => {
    expect(sharesSumToTotal(CIVIC_SPLIT_DEFAULT)).toBe(true);
  });

  it('moving one slider rebalances the other two in proportion', () => {
    const next = rebalanceShares({ locality: 40, region: 40, nation: 20 }, 'locality', 70);
    expect(next.locality).toBe(70);
    expect(sum(next)).toBe(100);
    // 30 remaining, split 40:20 → 20:10
    expect(next).toEqual({ locality: 70, region: 20, nation: 10 });
  });

  it('holds at the edges — 0 and 100 — and when the others were already 0', () => {
    for (const value of [0, 100, 37]) {
      expect(sum(rebalanceShares({ locality: 100, region: 0, nation: 0 }, 'region', value))).toBe(
        100
      );
      expect(sum(rebalanceShares({ locality: 1, region: 1, nation: 98 }, 'nation', value))).toBe(
        100
      );
    }
  });

  it('the schema rejects a split that is not one', () => {
    const base = { country_code: 'ch', region: 'Zürich', locality: 'Witikon' };
    expect(
      civicSplitInputSchema.safeParse({ ...base, shares: { locality: 60, region: 30, nation: 20 } })
        .success
    ).toBe(false);
    const ok = civicSplitInputSchema.safeParse({
      ...base,
      shares: { locality: '60', region: '30', nation: '10' },
      note: '',
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.country_code).toBe('CH');
      expect(ok.data.note).toBeNull();
      expect(ok.data.is_public).toBe(false);
    }
  });
});

describe('what the Cat is told becomes a whole split', () => {
  const current: CivicShares = { locality: 34, region: 33, nation: 33 };

  it('one stated share rebalances the rest', () => {
    const r = mergeShares(current, { locality: 60 });
    expect(r.ok && r.shares.locality).toBe(60);
    expect(r.ok && sum(r.shares)).toBe(100);
  });

  it('two stated shares fill in the third', () => {
    const r = mergeShares(current, { locality: 50, region: 30 });
    expect(r).toEqual({ ok: true, shares: { locality: 50, region: 30, nation: 20 } });
  });

  it('three that do not add up are refused, not silently fixed', () => {
    expect(mergeShares(current, { locality: 50, region: 30, nation: 30 }).ok).toBe(false);
    expect(mergeShares(current, { locality: 80, region: 30 }).ok).toBe(false);
  });
});

describe('the aggregate is k-anonymous and still sums to 100', () => {
  const row = (locality: string, l: number, r: number, n: number) => ({
    country_code: 'CH',
    region: 'Zürich',
    locality,
    region_key: 'zürich',
    locality_key: locality.trim().toLowerCase(),
    share_locality: l,
    share_region: r,
    share_nation: n,
  });

  it('hides a place below the minimum group', () => {
    const rows = [
      ...Array.from({ length: CIVIC_SPLIT_MIN_GROUP }, () => row('Witikon', 60, 30, 10)),
      ...Array.from({ length: CIVIC_SPLIT_MIN_GROUP - 1 }, () => row('Höngg', 20, 30, 50)),
    ];
    const out = summarizeByPlace(rows);
    expect(out.map(p => p.locality)).toEqual(['Witikon']);
    expect(out[0].count).toBe(CIVIC_SPLIT_MIN_GROUP);
  });

  it('groups by the case-insensitive key and rounds means to a whole 100', () => {
    const out = summarizeByPlace(
      [row('Witikon', 70, 20, 10), row('witikon ', 33, 33, 34), row('WITIKON', 50, 25, 25)],
      3
    );
    expect(out).toHaveLength(1);
    expect(sum(out[0].shares)).toBe(100);
  });

  it('largest-remainder rounding keeps the total at 100', () => {
    expect(sum(roundToTotal({ locality: 33.3333, region: 33.3333, nation: 33.3334 }))).toBe(100);
    expect(sum(roundToTotal({ locality: 50.5, region: 24.75, nation: 24.75 }))).toBe(100);
  });
});

describe('the caveat rides with every surface', () => {
  it.each([
    'src/components/civic-split/CivicSplitScreen.tsx',
    'src/components/profile/ProfileCivicSplit.tsx',
  ])('%s renders CIVIC_SPLIT_CAVEAT', file => {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    expect(source).toContain('CIVIC_SPLIT_CAVEAT');
  });

  it('says what it must — that the law is untouched', () => {
    expect(CIVIC_SPLIT_CAVEAT).toMatch(/does not change what the law takes/i);
  });
});

describe('the migration enforces what the code assumes', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260928080000_civic_splits.sql'),
    'utf8'
  ).replace(/^[ \t]*--.*$/gm, '');

  it('one row per actor, shares that sum to 100, RLS on', () => {
    expect(sql).toMatch(/actor_id UUID NOT NULL UNIQUE/);
    expect(sql).toMatch(/share_locality \+ share_region \+ share_nation = 100/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
  });

  it('the public view carries only public rows', () => {
    expect(sql).toMatch(/CREATE OR REPLACE VIEW civic_splits_public[\s\S]*WHERE is_public = true/);
    expect(sql).not.toMatch(/security_invoker\s*=\s*true/);
  });
});
