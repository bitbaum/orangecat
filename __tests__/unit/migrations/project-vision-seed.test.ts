import fs from 'fs';
import path from 'path';
import { ECOSYSTEM } from '@/config/ecosystem';

/**
 * The vision seed and the ecosystem config must name the same two projects.
 *
 * A data migration that writes prose into specific rows is only correct while
 * the ids it hardcodes are the rows it means. `src/config/ecosystem.ts` holds
 * those same two ids as the production defaults behind
 * NEXT_PUBLIC_ORANGECAT_PROJECT_ID / NEXT_PUBLIC_LOKI_ORANGECAT_PROJECT_ID, and
 * a migration file cannot import it — so nothing but this test connects them.
 * Change one default without the other and a fresh-database replay writes
 * OrangeCat's vision onto whatever project now holds that id.
 *
 * The `vision IS NULL` guard is asserted for the same reason: it is what makes
 * the seed a seed. Without it a replay overwrites whatever the owner has since
 * written, and the owner-editable field would quietly revert to shipped copy.
 */

const MIGRATION = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260914013000_a_project_can_say_where_it_is_going.sql'
);

describe('project vision seed', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8');

  it('adds the column additively', () => {
    expect(sql).toMatch(/ALTER TABLE projects ADD COLUMN IF NOT EXISTS vision TEXT;/);
  });

  it('seeds the two projects the ecosystem config names', () => {
    const seeded = [...sql.matchAll(/WHERE id = '([0-9a-f-]{36})'/g)].map(m => m[1]);

    expect(seeded).toEqual([ECOSYSTEM.orangeCat.projectId, ECOSYSTEM.loki.projectId]);
  });

  it('never overwrites a vision the owner has since written', () => {
    const updates = [...sql.matchAll(/UPDATE projects\b[\s\S]*?;/g)].map(m => m[0]);

    expect(updates).toHaveLength(2);
    for (const update of updates) {
      expect(update).toMatch(/AND vision IS NULL;$/);
    }
  });
});
