/**
 * A Supabase client double that RECORDS every query it is asked to run and
 * answers from a responder, so a test can assert both what came back and
 * what was asked (filters, scopes, writes) — the latter is where visibility
 * and "no N+1" live.
 */

export interface RecordedQuery {
  table: string;
  calls: Array<[string, unknown[]]>;
  /** Shorthand: was this filter method called with these leading args? */
  has(method: string, ...args: unknown[]): boolean;
  /** The values passed to update()/insert(), if any. */
  write?: { op: 'update' | 'insert'; values: Record<string, unknown> };
}

export type Responder = (q: RecordedQuery) => { data?: unknown; error?: unknown };

const METHODS = [
  'select',
  'eq',
  'neq',
  'in',
  'is',
  'gt',
  'gte',
  'lt',
  'lte',
  'or',
  'not',
  'order',
  'limit',
  'range',
];

export function recordingClient(responder: Responder) {
  const queries: RecordedQuery[] = [];
  const client = {
    from(table: string) {
      const q: RecordedQuery = {
        table,
        calls: [],
        has(method: string, ...args: unknown[]) {
          return this.calls.some(
            ([m, a]) =>
              m === method && args.every((v, i) => JSON.stringify(a[i]) === JSON.stringify(v))
          );
        },
      };
      queries.push(q);
      const builder: Record<string, unknown> = {};
      for (const m of METHODS) {
        builder[m] = (...args: unknown[]) => {
          q.calls.push([m, args]);
          return builder;
        };
      }
      builder.update = (values: Record<string, unknown>) => {
        q.write = { op: 'update', values };
        return builder;
      };
      builder.insert = (values: Record<string, unknown>) => {
        q.write = { op: 'insert', values };
        return builder;
      };
      const settle = () => {
        const r = responder(q);
        return { data: r.data ?? null, error: r.error ?? null };
      };
      builder.single = () => Promise.resolve(settle());
      builder.maybeSingle = () => Promise.resolve(settle());
      builder.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(settle()).then(resolve, reject);
      return builder;
    },
  };
  return { client, queries };
}
