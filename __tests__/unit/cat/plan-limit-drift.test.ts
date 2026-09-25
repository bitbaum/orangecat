/**
 * Plan-limit drift guard — machine-enforces the SSOT across the one boundary
 * config/cat-plans.ts cannot reach: SQL.
 *
 * The free daily limit is ENFORCED in Postgres (check_platform_limit,
 * increment_platform_usage, the user_plans default and the signup trigger),
 * where literals can't import CAT_FREE_DAILY_LIMIT. Historically the TS
 * constant and the SQL literals were maintained by hand in parallel — the
 * classic two-sources-of-truth setup that WILL diverge. This test reads the
 * migrations and fails the moment either side changes alone, with the fix
 * spelled out.
 *
 * If this test fails you have exactly two valid moves:
 *   1. You changed CAT_FREE_DAILY_LIMIT → write a NEW forward migration that
 *      updates the SQL functions/default to the same number (never edit the
 *      baseline), then extend MIGRATION_FILES below with it.
 *   2. You changed the SQL → update CAT_FREE_DAILY_LIMIT to match.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import {
  CAT_FREE_DAILY_LIMIT,
  CAT_SUPPORTER_DAILY_LIMIT,
  CAT_PLANS,
  SETTINGS_AI_ANCHORS,
} from '@/config/cat-plans';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

/** Every migration that states the free daily limit as a literal. */
const MIGRATION_FILES = ['20240101000001_baseline_public_schema.sql'];

function readMigration(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
}

describe('plan limit SSOT (TS ↔ SQL drift guard)', () => {
  const baseline = readMigration(MIGRATION_FILES[0]);

  it('check_platform_limit / increment_platform_usage literals match CAT_FREE_DAILY_LIMIT', () => {
    // All the shapes the baseline uses to state the free limit inside the
    // two quota functions: `v_daily_limit INTEGER := N;`,
    // `COALESCE(up.daily_limit, N)`, `v_daily_limit := N;`.
    const literalSites = [
      ...baseline.matchAll(/v_daily_limit\s+INTEGER\s*:=\s*(\d+)/gi),
      ...baseline.matchAll(/COALESCE\(\s*up\.daily_limit\s*,\s*(\d+)\s*\)/gi),
      ...baseline.matchAll(/v_daily_limit\s*:=\s*(\d+)\s*;/gi),
    ].map(m => Number(m[1]));

    expect(literalSites.length).toBeGreaterThanOrEqual(4);
    for (const value of literalSites) {
      expect(value).toBe(CAT_FREE_DAILY_LIMIT);
    }
  });

  it('user_plans default and the signup trigger match CAT_FREE_DAILY_LIMIT', () => {
    const columnDefault = baseline.match(/daily_limit\s+integer\s+DEFAULT\s+(\d+)/i);
    expect(columnDefault).not.toBeNull();
    expect(Number(columnDefault![1])).toBe(CAT_FREE_DAILY_LIMIT);

    const signupInsert = baseline.match(
      /INSERT INTO public\.user_plans\s*\(user_id,\s*tier,\s*daily_limit\)\s*VALUES\s*\(NEW\.id,\s*'free',\s*(\d+)\)/i
    );
    expect(signupInsert).not.toBeNull();
    expect(Number(signupInsert![1])).toBe(CAT_FREE_DAILY_LIMIT);
  });

  it('no LATER migration restates a daily limit without being registered here', () => {
    // A future migration that touches daily_limit with a literal is a new
    // drift site — it must be added to MIGRATION_FILES with assertions, not
    // slipped in silently.
    const later = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !MIGRATION_FILES.includes(f))
      .filter(f => /daily_limit/i.test(readMigration(f)));
    expect(later).toEqual([]);
  });

  it('marketing copy advertises the enforced numbers', () => {
    // The plan cards derive bullets from the constants via template strings;
    // this pins the derivation so a hand-edited bullet can't drift.
    const free = CAT_PLANS.find(p => p.id === 'free')!;
    expect(free.bullets[0]).toContain(String(CAT_FREE_DAILY_LIMIT));
    const supporter = CAT_PLANS.find(p => p.id === 'supporter')!;
    expect(supporter.bullets[0]).toContain(String(CAT_SUPPORTER_DAILY_LIMIT));
  });

  it('settings anchors point at sections that exist', () => {
    // SETTINGS_AI_ANCHORS deep-links (#credits/#byok/#local) are config facts;
    // the ids live in RunsOnSection, which both /settings/ai and the Cat
    // settings page render. If a section is renamed or removed the pricing
    // CTAs would silently land on the page top — fail instead.
    const aiPage = readFileSync(
      join(process.cwd(), 'src', 'components', 'cat-settings', 'RunsOnSection.tsx'),
      'utf8'
    );
    for (const anchor of Object.values(SETTINGS_AI_ANCHORS)) {
      const id = anchor.split('#')[1];
      expect(aiPage).toContain(`id="${id}"`);
    }
  });

  it('supporter grants never hardcode the limit', () => {
    // grant.ts must import CAT_SUPPORTER_DAILY_LIMIT — a literal there would
    // bypass the SSOT the moment the cap changes.
    const grant = readFileSync(
      join(process.cwd(), 'src', 'services', 'supporter', 'grant.ts'),
      'utf8'
    );
    expect(grant).toContain('CAT_SUPPORTER_DAILY_LIMIT');
    expect(grant).not.toMatch(/daily_limit:\s*\d+/);
  });
});
