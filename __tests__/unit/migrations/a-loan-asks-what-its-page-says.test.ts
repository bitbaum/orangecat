/**
 * A loan on Discover and in search asks what its own page says it asks.
 *
 * On 2026-11-12 the one public loan showed on Discover as "Asks $555,555.00"
 * while its page said "Original: $500.00". The loan branch of
 * public_documents() — the SQL behind search_public, public_counts and
 * global_search — read loans.amount, a legacy column the create form fills
 * once and nothing updates; the page reads original_amount.
 *
 * Source-level because the function runs only in Postgres; comment-blind
 * because the migration's own prose names both columns. Pinned against the
 * NEWEST migration that defines the function, so a later re-creation that
 * copies an older body back in fails here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableName } from '@/config/entity-registry';

const DEFINES = 'FUNCTION public.public_documents()';

// Strip `-- ...` comments so prose cannot satisfy (or trip) a code assertion.
const stripComments = (text: string): string => text.replace(/--.*$/gm, '');

const definition = (() => {
  const dir = join(process.cwd(), 'supabase', 'migrations');
  const newest = readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => ({ f, sql: stripComments(readFileSync(join(dir, f), 'utf8')) }))
    .filter(({ sql }) => sql.includes(DEFINES))
    .pop();
  const sql = newest?.sql ?? '';
  const start = sql.indexOf(DEFINES);
  return { file: newest?.f, sql: sql.slice(start, sql.indexOf('$$;', start)) };
})();

/** Split a SELECT list on its top-level commas. */
function selectItems(list: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of list) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  items.push(current.trim());
  return items.map(item => item.replace(/\s+/g, ' '));
}

/** The output columns, in order, from RETURNS TABLE(...). */
const returnedColumns = (() => {
  const m = definition.sql.match(/RETURNS TABLE\(([\s\S]*?)\)\s*LANGUAGE/);
  return selectItems(m?.[1] ?? '').map(col => col.split(' ')[0]);
})();

/** What one table's branch selects, item by item. */
function branchSelect(table: string): string[] {
  const branch = definition.sql
    .split('UNION ALL')
    .find(b => new RegExp(`FROM public\\.${table}\\s`).test(b));
  const m = branch?.match(/SELECT([\s\S]*?)\bFROM public\./);
  return m ? selectItems(m[1]) : [];
}

describe('public_documents: a loan asks its original amount', () => {
  const amountAt = returnedColumns.indexOf('amount');
  const loan = branchSelect(getTableName('loan'));

  it('finds the newest definition and its amount column', () => {
    expect(definition.file).toBeDefined();
    expect(amountAt).toBeGreaterThan(-1);
    expect(loan).toHaveLength(returnedColumns.length);
  });

  it('fills amount from original_amount, the figure the loan page shows', () => {
    // Failure here: Discover and search show a different ask from the page.
    expect(loan[amountAt]).toBe('x.original_amount');
  });

  it('never reads the legacy loans.amount column', () => {
    // amount DEFAULTs to 1,000,000 and is never updated after the form's create;
    // the Cat's create_loan does not set it at all.
    expect(loan.some(item => /\bx\.amount\b/.test(item))).toBe(false);
  });
});
