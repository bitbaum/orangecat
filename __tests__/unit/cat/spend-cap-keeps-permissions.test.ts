/**
 * Saving a Cat spending cap must not switch payment actions on.
 *
 * Every action without a row of its own falls back to its category's '*' row.
 * Saving a cap wrote that row with `granted: true`, so on an account that never
 * chose, Send Payment, Fund Project and four more moved from Off to "Ask
 * first" (UX/UI audit 2026-11-12, owner decision 2).
 */
import { CatPermissionService } from '@/services/cat/permission-service';
import { effectivePermission } from '@/services/cat/effective-permission';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

type Row = Record<string, unknown>;

/** A cat_permissions table in memory, with the query shapes the service uses. */
function fakeSupabase(initial: Row[] = []) {
  const rows: Row[] = initial.map(r => ({ ...r }));
  const key = (r: Row) => `${r.user_id}|${r.action_id}|${r.category}`;
  const upsert = (input: Row | Row[]) => {
    for (const incoming of Array.isArray(input) ? input : [input]) {
      const found = rows.find(r => key(r) === key(incoming));
      if (found) {
        Object.assign(found, incoming);
      } else {
        rows.push({ ...incoming });
      }
    }
    const result = { data: null, error: null };
    const chain = {
      select: () => chain,
      single: () => Promise.resolve({ data: Array.isArray(input) ? input[0] : input, error: null }),
      then: (resolve: (v: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  const select = () => {
    const filters: Row = {};
    const chain = {
      eq: (column: string, value: unknown) => {
        filters[column] = value;
        return chain;
      },
      maybeSingle: () =>
        Promise.resolve({
          data: rows.find(r => Object.entries(filters).every(([k, v]) => r[k] === v)) ?? null,
          error: null,
        }),
    };
    return chain;
  };
  return {
    rows,
    client: { from: () => ({ upsert, select }) },
  };
}

const USER = 'user-1';

describe('saving a spending cap', () => {
  it('leaves Send Payment off on an account that never chose', async () => {
    const db = fakeSupabase();
    const service = new CatPermissionService(db.client as never);

    await service.grantCategory(USER, 'payments', { maxBtcPerAction: 0.001, maxBtcPerDay: 0.01 });

    const star = db.rows.find(r => r.action_id === '*');
    expect(star).toMatchObject({
      granted: false,
      max_btc_per_action: 0.001,
      max_btc_per_day: 0.01,
    });
    expect(effectivePermission('send_payment', db.rows as never).allowed).toBe(false);
  });

  it('keeps payments on for an account that had turned them on', async () => {
    const db = fakeSupabase([
      {
        user_id: USER,
        action_id: '*',
        category: 'payments',
        granted: true,
        requires_confirmation: true,
      },
    ]);
    const service = new CatPermissionService(db.client as never);

    await service.grantCategory(USER, 'payments', { maxBtcPerDay: 0.02 });

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ granted: true, max_btc_per_day: 0.02 });
    expect(effectivePermission('send_payment', db.rows as never).allowed).toBe(true);
  });

  it('clears a cap with an explicit null and keeps the other', async () => {
    const db = fakeSupabase([
      {
        user_id: USER,
        action_id: '*',
        category: 'payments',
        granted: false,
        max_btc_per_action: 0.001,
        max_btc_per_day: 0.01,
      },
    ]);
    const service = new CatPermissionService(db.client as never);

    await service.grantCategory(USER, 'payments', { maxBtcPerAction: null });

    expect(db.rows[0]).toMatchObject({
      granted: false,
      max_btc_per_action: null,
      max_btc_per_day: 0.01,
    });
  });
});
