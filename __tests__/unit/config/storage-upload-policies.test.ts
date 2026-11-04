/**
 * Every bucket the BROWSER uploads to with the user's own token needs an
 * INSERT policy on storage.objects in a migration — otherwise uploads fail live
 * with "new row violates row-level security policy" (Nov 2026: avatars,
 * banners, article covers and proofs all failed after the self-host move,
 * because their policies had only ever existed in the hosted dashboard).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'supabase/migrations');
const sql = readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(dir, f), 'utf8'))
  .join('\n');

describe('storage upload policies', () => {
  it.each(['avatars', 'banners', 'proofs'])('%s has an insert policy in a migration', bucket => {
    const inserts = sql.match(/for insert[\s\S]*?;/gi) ?? [];
    expect(inserts.some(p => p.includes(`'${bucket}'`))).toBe(true);
  });
});
