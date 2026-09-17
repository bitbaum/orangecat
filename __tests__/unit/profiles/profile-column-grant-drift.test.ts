/**
 * Profile private-column guard — the third time this exact class shipped.
 *
 * `profiles` has RLS `USING (true)`, which is ROW-level and says nothing about
 * columns, so what a client role may read is decided entirely by GRANTs. Twice
 * that was wrong and nothing noticed:
 *
 *   2026-09-17  `anon` could read all 50 columns of all rows. The anon key ships
 *               in the bundle at orangecat.ch, so that was 65 account emails
 *               readable by anyone with curl. Closed by 20260917120100.
 *   2026-09-17  `authenticated` could still read them — and signup is open and
 *               auto-confirming, so "authenticated" costs one HTTP request.
 *               73 account emails. Closed by 20260917163100.
 *
 * Before both, the same shape on `wallets` (20260802120000), which already has
 * its own guard in ../wallets/wallet-column-grant-drift.test.ts. Three
 * instances is two more than the rule allows, so this file ends the class
 * rather than the instance.
 *
 * THE FOUR WAYS IT COMES BACK, one test each:
 *   1. the TS list and the SQL drift apart
 *   2. a later migration grants a private column back
 *   3. application code reads a private column with a client-role client
 *   4. a column added to profiles later is never granted, and every profile
 *      read starts failing 42501 — Postgres does not auto-grant into an
 *      existing column-level GRANT. This is the one that presents as a broken
 *      page rather than a missing grant.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { PRIVATE_PROFILE_COLUMNS } from '@/config/database-tables';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const SRC_DIR = join(ROOT, 'src');

/** The migration that first took a private column away from a client role. */
const FIRST_LOCKDOWN = '20260917120100';

const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.sql'))
  .sort();
const readMigration = (f: string) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8');

// ---------------------------------------------------------------- parsers --

/**
 * The column names a migration declares private, from the
 * `INSERT INTO private_profile_columns ... VALUES ('a'), ('b')` block both
 * lockdown migrations use.
 */
export function declaredPrivateColumns(sql: string): Set<string> {
  const block = sql.match(
    /INSERT\s+INTO\s+private_profile_columns[^;]*?VALUES([\s\S]*?);/i
  );
  if (!block) return new Set<string>();
  return new Set([...block[1]!.matchAll(/'([a-z0-9_]+)'/gi)].map(m => m[1]!));
}

/** Columns explicitly GRANTed SELECT on public.profiles to a CLIENT role. */
export function grantedProfileColumns(sql: string): Set<string> {
  const out = new Set<string>();
  const re =
    /GRANT\s+SELECT\s*\(([^)]*)\)\s*ON\s+(?:TABLE\s+)?public\.profiles\s+TO\s+([a-z_,\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const roles = m[2]!.toLowerCase();
    // service_role is meant to read everything; only client roles matter here.
    if (!/\banon\b|\bauthenticated\b/.test(roles)) continue;
    for (const c of m[1]!.split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean)) {
      out.add(c);
    }
  }
  return out;
}

/** Columns a migration ADDs to public.profiles. */
export function addedProfileColumns(sql: string): string[] {
  const found: string[] = [];
  const re = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?profiles\b([\s\S]*?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) {
    const add = /ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([a-z0-9_]+)"?/gi;
    let a: RegExpExecArray | null;
    while ((a = add.exec(m[1]!)) !== null) found.push(a[1]!);
  }
  return found;
}

// ------------------------------------------------------------ source scan --

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Does this file get a service-role client? Those are exempt by design. */
function usesAdminClient(text: string): boolean {
  return /createAdminClient|getAdminClient|SUPABASE_SERVICE_ROLE_KEY/.test(text);
}

/**
 * Reads of the profiles TABLE whose projection would need a private column.
 * Returns one finding per offending call site.
 *
 * Deliberately narrow: it looks only at a `.select(...)` that FOLLOWS a
 * `.from(DATABASE_TABLES.PROFILES)` / `fromTable(x, DATABASE_TABLES.PROFILES)`
 * within the same chain, because `select('*')` on a VIEW is exactly what the
 * fix asks callers to do and must not be flagged.
 */
export function privateProfileReads(text: string): string[] {
  const findings: string[] = [];
  const from = /(?:\.from\(\s*DATABASE_TABLES\.PROFILES\s*\)|fromTable\([^,]+,\s*DATABASE_TABLES\.PROFILES\s*\))/g;
  let m: RegExpExecArray | null;
  while ((m = from.exec(text)) !== null) {
    // Bound the chain at the end of the STATEMENT. Slicing a fixed window
    // instead put the next statement inside it, and since the fix for these
    // very call sites is "write to the table, then read the row back from
    // OWN_PROFILE_VIEW on the next line", the window swallowed the read-back
    // and reported three fixed sites in writer.ts as still broken.
    const semi = text.indexOf(';', m.index);
    const chain = text.slice(m.index, semi === -1 ? text.length : semi);
    const select = chain.match(/\.select\(\s*([^)]*?)\s*\)/);
    if (!select) continue;
    const projection = select[1]!;

    // `head: true` asks PostgREST for a count and no rows. count(*) needs SELECT
    // on the table or any one column, never on a particular one, so a count
    // probe cannot reach a private column however it spells its projection.
    if (/head\s*:\s*true/.test(chain)) continue;

    // `.select()` with no argument is RETURNING *, and so is select('*').
    const isStar = projection === '' || /^['"`]\s*\*\s*['"`]/.test(projection);
    const namesPrivate = PRIVATE_PROFILE_COLUMNS.some(c =>
      new RegExp(`\\b${c}\\b`).test(projection)
    );
    if (isStar || namesPrivate) {
      findings.push(isStar ? 'select(*) on profiles' : `select naming ${projection.slice(0, 60)}`);
    }
  }
  return findings;
}

// ------------------------------------------------------------------ tests --

describe('profiles private columns', () => {
  it('the TS list and every lockdown migration name the same columns', () => {
    const inCode = new Set<string>(PRIVATE_PROFILE_COLUMNS);
    const lockdowns = migrationFiles.filter(
      f => declaredPrivateColumns(readMigration(f)).size > 0
    );

    // Non-empty guards the parser: a regex that silently matched nothing would
    // turn this whole file into a green light over an unchecked invariant.
    expect(lockdowns.length).toBeGreaterThan(0);

    for (const file of lockdowns) {
      const inSql = declaredPrivateColumns(readMigration(file));
      const sqlOnly = [...inSql].filter(c => !inCode.has(c)).sort();
      const codeOnly = [...inCode].filter(c => !inSql.has(c)).sort();
      expect({ file, sqlOnly, codeOnly }).toEqual({ file, sqlOnly: [], codeOnly: [] });
    }
  });

  it('no migration ever grants a private column to a client role', () => {
    // A later file granting one back would undo the lockdown just as
    // effectively as editing it.
    for (const file of migrationFiles) {
      const granted = grantedProfileColumns(readMigration(file));
      for (const secret of PRIVATE_PROFILE_COLUMNS) {
        expect({ file, granted: granted.has(secret) }).toEqual({ file, granted: false });
      }
    }
  });

  it('every profiles column added after the lockdown is granted back', () => {
    // Postgres does not add a column to an existing column-level GRANT. The
    // lockdown migrations compute their grant from the catalog AS IT WAS when
    // they ran, so a column added afterwards is readable by nobody and the
    // first `select` that mentions it 42501s — for every signed-in user, not
    // just the new feature.
    const granted = new Set<string>();
    const added: Array<{ file: string; column: string }> = [];

    for (const file of migrationFiles) {
      const sql = readMigration(file);
      for (const c of grantedProfileColumns(sql)) granted.add(c);
      if (file.slice(0, 14) >= FIRST_LOCKDOWN) {
        for (const c of addedProfileColumns(sql)) added.push({ file, column: c });
      }
    }

    const ungranted = added.filter(
      ({ column }) =>
        !granted.has(column) && !(PRIVATE_PROFILE_COLUMNS as readonly string[]).includes(column)
    );

    // Say the coverage out loud: a pass over an empty set reads exactly like a
    // pass over a checked one.
    // eslint-disable-next-line no-console
    console.log(
      `[profile-grants] ${migrationFiles.length} migration(s) scanned, ` +
        `${added.length} profiles ADD COLUMN after ${FIRST_LOCKDOWN}, ` +
        `${ungranted.length} ungranted`
    );

    expect(ungranted).toEqual([]);
  });

  it('no client-role code reads a private column off the profiles table', () => {
    const offenders: Array<{ file: string; finding: string }> = [];
    let scanned = 0;

    for (const file of sourceFiles(SRC_DIR)) {
      const text = readFileSync(file, 'utf8');
      if (!text.includes('DATABASE_TABLES.PROFILES')) continue;
      scanned++;
      if (usesAdminClient(text)) continue;
      for (const finding of privateProfileReads(text)) {
        offenders.push({ file: relative(ROOT, file), finding });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`[profile-reads] ${scanned} file(s) touch the profiles table`);
    expect(scanned).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});

describe('the parsers actually parse', () => {
  // All four tests above pass right now, and three of them would pass just as
  // happily against a regex that matches nothing at all.
  it('reads a declared private-column list', () => {
    const sql =
      "INSERT INTO private_profile_columns (column_name)\nVALUES ('email'), ('phone'), ('contact_email');";
    expect([...declaredPrivateColumns(sql)].sort()).toEqual(['contact_email', 'email', 'phone']);
  });

  it('reads a GRANT list for a client role, and ignores service_role', () => {
    expect([...grantedProfileColumns('GRANT SELECT (id, username) ON TABLE public.profiles TO anon;')].sort()).toEqual(['id', 'username']);
    expect(grantedProfileColumns('GRANT SELECT (email) ON public.profiles TO service_role;').size).toBe(0);
    expect(grantedProfileColumns('GRANT SELECT (id) ON public.wallets TO anon;').size).toBe(0);
  });

  it('spots a column added to profiles, and only to profiles', () => {
    expect(addedProfileColumns('ALTER TABLE public.profiles ADD COLUMN foo text;')).toEqual(['foo']);
    expect(addedProfileColumns('ALTER TABLE profiles ADD COLUMN IF NOT EXISTS "bar" int;')).toEqual(['bar']);
    expect(addedProfileColumns('ALTER TABLE public.wallets ADD COLUMN foo text;')).toEqual([]);
  });

  it('catches the real mistakes, and clears the real fixes', () => {
    // The two shapes that leaked:
    expect(
      privateProfileReads("supabase.from(DATABASE_TABLES.PROFILES).select('*').eq('id', id)")
    ).toHaveLength(1);
    expect(
      privateProfileReads("supabase.from(DATABASE_TABLES.PROFILES).select('id, email')")
    ).toHaveLength(1);
    // A bare .select() after a write is RETURNING *, which needs the grant too:
    expect(
      privateProfileReads("supabase.from(DATABASE_TABLES.PROFILES).update(d).eq('id', u).select()")
    ).toHaveLength(1);

    // ...and the shapes the fix introduces, which must NOT be flagged:
    expect(privateProfileReads("fromTable(supabase, OWN_PROFILE_VIEW).select('*')")).toEqual([]);
    expect(privateProfileReads("supabase.from(PUBLIC_PROFILES_VIEW).select('*')")).toEqual([]);
    expect(
      privateProfileReads("supabase.from(DATABASE_TABLES.PROFILES).select('id, username')")
    ).toEqual([]);
    expect(
      privateProfileReads("supabase.from(DATABASE_TABLES.PROFILES).update(d).eq('id', u)")
    ).toEqual([]);

    // The write-then-read-back pair, which is the fix: the read-back is a
    // SEPARATE statement on a view and must not be attributed to the write.
    expect(
      privateProfileReads(
        "await fromTable(supabase, DATABASE_TABLES.PROFILES).update(d).eq('id', u);\n" +
          "const { data } = await fromTable(supabase, OWN_PROFILE_VIEW).select('*').single();"
      )
    ).toEqual([]);

    // A count probe returns no columns, so it cannot reach a private one.
    expect(
      privateProfileReads(
        "supabase.from(DATABASE_TABLES.PROFILES).select('*', { count: 'exact', head: true })"
      )
    ).toEqual([]);
  });
});
