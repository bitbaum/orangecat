/**
 * "Exactly one primary wallet per entity" was enforced only in application
 * code, and that code had three holes — each of which strands a flag where no
 * later correction can reach it:
 *
 *   1. enforceSinglePrimary() cleared siblings with `.eq('is_active', true)`,
 *      so a wallet deactivated WHILE primary kept the flag permanently.
 *   2. createWallet() decides is_primary from a count of ACTIVE wallets, so
 *      once an entity's wallets are all soft-deleted the next one is born
 *      primary — even though a stranded primary already exists.
 *   3. The soft delete wrote `is_active: false` and left is_primary alone.
 *
 * Run that cycle and the flags accumulate. Production held FOUR primary
 * wallets for one profile, all deactivated, while the two live wallets were not
 * primary at all — so every "the primary wallet" lookup resolved to a deleted
 * row, non-deterministically.
 *
 * Holes 1 and 3 are closed in code below; the invariant itself is now the
 * database's job (partial unique indexes), so hole 2 cannot produce a duplicate
 * even if a client posts `is_primary: true` directly.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { enforceSinglePrimary } from '@/domain/wallets/updateWallet';

const MIGRATIONS = join(process.cwd(), 'supabase/migrations');
const allMigrations = readdirSync(MIGRATIONS)
  .filter(f => f.endsWith('.sql'))
  .map(f => readFileSync(join(MIGRATIONS, f), 'utf8'))
  .join('\n');

/** Records the PostgREST chain so the test can assert which filters were applied. */
function mockSupabase() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['update', 'eq', 'neq', 'match', 'select']) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  // The chain is awaited at the end of enforceSinglePrimary.
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ error: null }).then(resolve);
  return {
    calls,
    client: { from: () => chain } as unknown as Parameters<typeof enforceSinglePrimary>[0],
  };
}

describe('enforceSinglePrimary', () => {
  it('clears EVERY sibling, not only the active ones', async () => {
    const { calls, client } = mockSupabase();

    await enforceSinglePrimary(
      client,
      { profile_id: 'profile-1', project_id: null } as Parameters<typeof enforceSinglePrimary>[1],
      'wallet-being-promoted'
    );

    expect(calls.find(c => c.method === 'update')?.args[0]).toEqual({ is_primary: false });
    expect(calls.find(c => c.method === 'neq')?.args).toEqual(['id', 'wallet-being-promoted']);
    expect(calls.find(c => c.method === 'match')?.args[0]).toEqual({ profile_id: 'profile-1' });

    // The regression. Scoping the sweep to live rows is precisely what let a
    // deactivated wallet keep is_primary forever: no promotion afterwards could
    // ever see it again. A function named "enforce single primary" that skips
    // rows is not enforcing anything.
    const activeFilter = calls.find(
      c => c.method === 'eq' && c.args[0] === 'is_active' && c.args[1] === true
    );
    expect(activeFilter).toBeUndefined();
  });

  it('scopes to the project when the wallet belongs to one', async () => {
    const { calls, client } = mockSupabase();
    await enforceSinglePrimary(
      client,
      { profile_id: null, project_id: 'project-9' } as Parameters<typeof enforceSinglePrimary>[1],
      'w-1'
    );
    expect(calls.find(c => c.method === 'match')?.args[0]).toEqual({ project_id: 'project-9' });
  });
});

describe('the database owns the invariant', () => {
  it('has a partial unique index per profile and per project', () => {
    expect(allMigrations).toMatch(/wallets_one_active_primary_per_profile/);
    expect(allMigrations).toMatch(/wallets_one_active_primary_per_project/);

    // Partial and scoped to LIVE rows — a soft-deleted wallet is not competing
    // to be primary, so constraining it would reject legitimate history.
    expect(allMigrations).toMatch(/WHERE is_primary AND is_active AND profile_id IS NOT NULL/);
    expect(allMigrations).toMatch(/WHERE is_primary AND is_active AND project_id IS NOT NULL/);
  });

  it('clears the flags that were already stranded', () => {
    // Without this the CREATE UNIQUE INDEX would be the only change, and the
    // four existing rows would keep claiming primary from beyond the grave.
    expect(allMigrations).toMatch(/SET is_primary = false\s+WHERE is_primary\s+AND NOT is_active/);
  });
});

describe('soft delete', () => {
  it('drops is_primary in the same write that deactivates the wallet', () => {
    // Read as source rather than exercised: the handler is wrapped in auth and
    // audit middleware whose mocking would test the harness, not the rule. The
    // rule is one object literal, and this is the ratchet that keeps it there.
    const route = readFileSync(join(process.cwd(), 'src/app/api/wallets/[id]/route.ts'), 'utf8');
    expect(route).toMatch(/is_active:\s*false,\s*is_primary:\s*false/);
  });
});
