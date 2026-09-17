/**
 * Wallet column-grant drift guard — the TS column list and the SQL GRANT that
 * makes it readable are two sources of truth for one fact.
 *
 * Migration 20260802120000 revoked table-level SELECT on `wallets` and replaced
 * it with an explicit COLUMN list, so that `nwc_connection_uri` (an encrypted
 * wallet-spending credential) is write-only for client roles. Every non-service
 * client therefore selects `WALLET_CLIENT_COLUMNS` — the code-side mirror of
 * that GRANT.
 *
 * The two must agree, and nothing enforced it.
 *
 * WHY IT MATTERS MORE THAN IT LOOKS
 *
 * **Postgres does not auto-grant a column added later.** Add a column to
 * wallets, add it to WALLET_CLIENT_COLUMNS because your query needs it, and the
 * SELECT starts failing with 42501 permission-denied for anon/authenticated —
 * for every wallet read on the site, not just the new feature. It presents as a
 * broken page, not as a missing grant, which is how #561 was spent finding it
 * once already. bitbaum/orangecat#563 finding 5.
 *
 * If this test fails you have exactly two valid moves:
 *   1. You added a column to WALLET_CLIENT_COLUMNS → write a NEW forward
 *      migration granting SELECT on it (never edit the baseline).
 *   2. You granted a new column in SQL → add it to WALLET_CLIENT_COLUMNS, or
 *      list it in SECRET_COLUMNS below if clients must never read it.
 *
 * Verified against production 2026-08-28: anon holds SELECT on exactly the 25
 * columns below; the table has 26; the one withheld is nwc_connection_uri.
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { WALLET_CLIENT_COLUMNS } from '@/config/database-tables';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');
const LOCKDOWN = '20260802120000_wallets_select_lockdown.sql';

/** Columns clients must NEVER be able to read, whatever the code asks for. */
const SECRET_COLUMNS = ['nwc_connection_uri'];

/** Split a comma-separated SQL/TS column list into a comparable set. */
function toColumnSet(list: string): Set<string> {
  return new Set(
    list
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
  );
}

/**
 * The column list from a `GRANT SELECT (...) ON public.wallets` statement.
 * Exported shape kept simple on purpose: a regex over SQL is only trustworthy
 * if you can see exactly what it matches, and the test below proves it does.
 */
export function grantedColumns(sql: string): Set<string> {
  const match = sql.match(/GRANT\s+SELECT\s*\(([^)]*)\)\s*ON\s+public\.wallets/i);
  return match ? toColumnSet(match[1]!) : new Set<string>();
}

/** Columns any migration ADDs to wallets, in file order. */
export function addedColumns(sql: string): string[] {
  const found: string[] = [];
  const re = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?wallets\b([\s\S]*?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const body = m[1]!;
    const add = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z0-9_]+)"?/gi;
    let a: RegExpExecArray | null;
    while ((a = add.exec(body)) !== null) found.push(a[1]!);
  }
  return found;
}

const migrationFiles = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
const readMigration = (f: string) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');

/**
 * Every column granted to client roles, across ALL migrations.
 *
 * The lockdown file alone is not the answer to "what may a client read": its
 * own instructions tell you to grant a NEW column in a NEW forward migration,
 * never by editing the baseline. Reading only the lockdown therefore failed the
 * first wallets column added after it — the drift was in this test, not in the
 * code it guards.
 */
function grantedAcrossMigrations(): Set<string> {
  const all = new Set<string>();
  for (const file of migrationFiles.sort()) {
    for (const c of grantedColumns(readMigration(file))) all.add(c);
  }
  return all;
}

describe('wallet column grants', () => {
  it('the SQL GRANT and WALLET_CLIENT_COLUMNS list the same columns', () => {
    const granted = grantedAcrossMigrations();
    const inCode = toColumnSet(WALLET_CLIENT_COLUMNS);

    // Non-empty guards the regex itself: a parser that silently matches nothing
    // would make this whole test a green light over an unchecked invariant.
    expect(granted.size).toBeGreaterThan(0);

    const grantedOnly = [...granted].filter((c) => !inCode.has(c)).sort();
    const codeOnly = [...inCode].filter((c) => !granted.has(c)).sort();

    expect({ grantedOnly, codeOnly }).toEqual({ grantedOnly: [], codeOnly: [] });
  });

  it('never grants a column the database is meant to keep secret', () => {
    // Across every migration: a later file granting the secret would undo the
    // lockdown just as effectively as editing it.
    const granted = grantedAcrossMigrations();
    for (const secret of SECRET_COLUMNS) {
      expect([...granted]).not.toContain(secret);
    }
    expect(toColumnSet(WALLET_CLIENT_COLUMNS).has('nwc_connection_uri')).toBe(false);
  });

  it('every column later added to wallets is granted, or declared secret', () => {
    // Postgres does not auto-grant a column added after the lockdown, so an
    // ADD COLUMN with no matching GRANT is a 42501 waiting for the first read.
    const allGranted = new Set<string>();
    const added: Array<{ file: string; column: string }> = [];

    for (const file of migrationFiles.sort()) {
      const sql = readMigration(file);
      for (const c of grantedColumns(sql)) allGranted.add(c);
      for (const c of addedColumns(sql)) added.push({ file, column: c });
    }

    const ungranted = added.filter(
      ({ column }) => !allGranted.has(column) && !SECRET_COLUMNS.includes(column)
    );

    // Say the coverage out loud: a silent pass over an empty set reads exactly
    // like a pass over a checked one. This stopped being vacuous when
    // open_accounting became the first wallets column added after the lockdown.
    // eslint-disable-next-line no-console
    console.log(
      `[wallet-grants] ${migrationFiles.length} migration(s) scanned, ` +
        `${added.length} wallets ADD COLUMN found, ${ungranted.length} ungranted`
    );

    expect(ungranted).toEqual([]);
  });
});

describe('the parsers actually parse', () => {
  // Proving detection on fixtures, because all three tests above currently pass
  // and two of them would pass just as happily against a regex that matches
  // nothing at all.
  it('reads a GRANT list', () => {
    const sql = 'GRANT SELECT (\n  id, label,\n  balance_btc\n) ON public.wallets TO anon;';
    expect([...grantedColumns(sql)].sort()).toEqual(['balance_btc', 'id', 'label']);
  });

  it('returns nothing for a GRANT on a different table', () => {
    expect(grantedColumns('GRANT SELECT (id) ON public.profiles TO anon;').size).toBe(0);
  });

  it('spots an added column, with or without IF NOT EXISTS', () => {
    expect(addedColumns('ALTER TABLE public.wallets ADD COLUMN foo text;')).toEqual(['foo']);
    expect(addedColumns('ALTER TABLE wallets ADD COLUMN IF NOT EXISTS "bar" int;')).toEqual(['bar']);
  });

  it('ignores a column added to another table', () => {
    expect(addedColumns('ALTER TABLE public.profiles ADD COLUMN foo text;')).toEqual([]);
  });

  it('catches the real mistake: added but never granted', () => {
    const sql = 'ALTER TABLE public.wallets ADD COLUMN sweep_key text;';
    const added = addedColumns(sql);
    const granted = grantedColumns(readMigration(LOCKDOWN));
    expect(added).toEqual(['sweep_key']);
    expect(granted.has('sweep_key')).toBe(false);
  });
});
