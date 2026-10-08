/**
 * A fake Supabase query builder that BEHAVES like a database.
 *
 * The usual hand-rolled test double returns a fixed row for any query, which
 * makes it blind to the thing most worth checking: the query itself. Drop
 * `.eq('is_active', true)` from wallet resolution and such a double keeps
 * returning the same wallet, so every test still passes while production
 * starts paying into deactivated wallets. Mutation testing found exactly that
 * class of hole across wallet resolution — filters and orderings that no test
 * constrained.
 *
 * So this one applies `eq`/`in`/`order` for real against in-memory rows: a
 * missing filter changes the rows that come back, and the test fails. Asserting
 * on `expect(eqSpy).toHaveBeenCalledWith(...)` would also catch it, but that
 * pins the *call* rather than the *effect* — it breaks on a harmless rewrite and
 * says nothing about what the caller does with the result.
 *
 * Deliberately not a Postgres emulator. It supports the operators our payment
 * queries actually use; anything else should be added when a real query needs it.
 */

export type Row = Record<string, unknown>;

/** Rows keyed by table name — the whole "database" for one test. */
export type FakeTables = Record<string, Row[]>;

export interface UpdateCall {
  table: string;
  patch: Row;
  /** Filters the update was scoped by, e.g. `{ id: 'pi-1', status: 'pending' }`. */
  match: Row;
}

export interface RpcCall {
  fn: string;
  args: Row;
}

export interface FakeSupabase {
  /** Pass where a `SupabaseClient` is expected. */
  client: never;
  /** Every `.update()` issued, in order. */
  updates: UpdateCall[];
  /** Every `.insert()` issued, in order. */
  inserts: Array<{ table: string; values: Row | Row[] }>;
  /** Every `.rpc()` issued, in order. */
  rpcs: RpcCall[];
  /** Tables as they stand now (inserts are appended). */
  tables: FakeTables;
}

export interface FakeSupabaseOptions {
  /** Result for a named RPC — a value, or a thrown/returned error. */
  rpc?: Record<string, { data?: unknown; error?: unknown }>;
  /** Force `.update()` to fail, to exercise write-failure paths. */
  updateError?: unknown;
}

type Predicate = (row: Row) => boolean;

function sortRows(rows: Row[], orders: Array<[string, boolean]>) {
  if (orders.length === 0) {
    return rows;
  }
  // Stable: later `.order()` calls are tie-breakers, so compare in call order.
  return [...rows].sort((a, b) => {
    for (const [col, ascending] of orders) {
      const av = a[col];
      const bv = b[col];
      if (av === bv) {
        continue;
      }
      // null/undefined sort last regardless of direction, as Postgres does by
      // default for ASC; good enough, and payment queries never rely on it.
      if (av === null || av === undefined) {
        return 1;
      }
      if (bv === null || bv === undefined) {
        return -1;
      }
      const cmp = av < bv ? -1 : 1;
      return ascending ? cmp : -cmp;
    }
    return 0;
  });
}

export function createFakeSupabase(
  tables: FakeTables,
  options: FakeSupabaseOptions = {}
): FakeSupabase {
  const state: FakeTables = Object.fromEntries(
    Object.entries(tables).map(([t, rows]) => [t, rows.map(r => ({ ...r }))])
  );
  const updates: UpdateCall[] = [];
  const inserts: Array<{ table: string; values: Row | Row[] }> = [];
  const rpcs: RpcCall[] = [];

  function from(table: string) {
    const predicates: Predicate[] = [];
    const match: Row = {};
    const orders: Array<[string, boolean]> = [];
    let pendingUpdate: Row | null = null;
    let limitTo: number | null = null;

    const rows = () => {
      const all = state[table] ?? [];
      const found = sortRows(
        all.filter(r => predicates.every(p => p(r))),
        orders
      );
      return limitTo === null ? found : found.slice(0, limitTo);
    };

    const settle = () => {
      if (pendingUpdate) {
        const affected = rows();
        updates.push({ table, patch: pendingUpdate, match: { ...match } });
        if (options.updateError) {
          return { data: null, error: options.updateError };
        }
        for (const row of affected) {
          Object.assign(row, pendingUpdate);
        }
        // `.update(...).select()` returns the affected rows — the exactly-once
        // paid transition reads that array to learn whether IT won the race.
        return { data: affected, error: null };
      }
      return { data: rows(), error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        match[col] = val;
        predicates.push(r => r[col] === val);
        return builder;
      },
      neq: (col: string, val: unknown) => {
        predicates.push(r => r[col] !== val);
        return builder;
      },
      in: (col: string, vals: unknown[]) => {
        predicates.push(r => vals.includes(r[col] as never));
        return builder;
      },
      // Range filter as Postgres applies it: a NULL never satisfies it. Values
      // compare as strings when both are strings (ISO timestamps sort that way),
      // otherwise as numbers.
      gte: (col: string, val: unknown) => {
        predicates.push(r => {
          const v = r[col];
          if (v === null || v === undefined) {
            return false;
          }
          return typeof v === 'string' && typeof val === 'string'
            ? v >= val
            : Number(v) >= Number(val);
        });
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        orders.push([col, opts?.ascending !== false]);
        return builder;
      },
      limit: (n: number) => {
        limitTo = n;
        return builder;
      },
      update: (patch: Row) => {
        pendingUpdate = patch;
        return builder;
      },
      insert: (values: Row | Row[]) => {
        inserts.push({ table, values });
        const list = Array.isArray(values) ? values : [values];
        state[table] = [...(state[table] ?? []), ...list.map(v => ({ ...v }))];
        return builder;
      },
      single: () => {
        const found = rows();
        if (pendingUpdate) {
          return Promise.resolve(settle());
        }
        return Promise.resolve(
          found.length === 1
            ? { data: found[0], error: null }
            : { data: null, error: { code: 'PGRST116', message: 'No rows found' } }
        );
      },
      maybeSingle: () => {
        if (pendingUpdate) {
          return Promise.resolve(settle());
        }
        return Promise.resolve({ data: rows()[0] ?? null, error: null });
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject),
    };
    return builder;
  }

  function rpc(fn: string, args: Row) {
    rpcs.push({ fn, args });
    const configured = options.rpc?.[fn];
    return Promise.resolve(configured ?? { data: null, error: { message: `no rpc ${fn}` } });
  }

  return {
    client: { from, rpc } as never,
    updates,
    inserts,
    rpcs,
    tables: state,
  };
}
