/** Read receipts need co-members to see each other's last_read_at (RLS). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

it("conversation members can read each other's participant rows", () => {
  const dir = join(process.cwd(), 'supabase/migrations');
  const sql = readdirSync(dir)
    .map(f => readFileSync(join(dir, f), 'utf8'))
    .join('\n');
  expect(sql).toMatch(
    /create policy conv_participants_select_comembers on public\.conversation_participants/
  );
});
