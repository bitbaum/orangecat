/**
 * Untyped Supabase access helpers — the ONE escape hatch for dynamic names.
 *
 * WHY: Supabase's TypeScript client types `from()` / `rpc()` against the
 * generated schema. When the table or function name comes from a runtime value
 * (DATABASE_TABLES.*, getTableName(entityType), a computed RPC name), TS can't
 * narrow the return type, so call sites historically cast `(sb.from(x) as any)`.
 * Rather than scatter that `any` — and its eslint-disable — across the codebase,
 * every dynamic-name access routes through here, so the escape hatch lives in
 * exactly one audited place (SSOT/DRY). Behaviour is identical to the raw call.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnySupabaseClient } from '@/lib/supabase/types';

/** A row whose column names are unknown at compile time — but whose values are not `any`. */
type LooseRow = Record<string, unknown>;

/**
 * A schema in which every table name is valid and every column is `unknown`.
 *
 * This is the typed alternative to `fromTable()` for generic helpers that query
 * MANY tables through one code path (`listEntitiesPage`, the entity list
 * handler, the sitemap): `.from(someString)` and `.eq(someColumn, v)` both
 * type-check, yet results come back as `Record<string, unknown>[]` rather than
 * `any[]`, so callers still have to narrow before use and inference in
 * downstream generic helpers does not collapse.
 */
type LooseSchema = {
  public: {
    Tables: {
      [table: string]: {
        Row: LooseRow;
        Insert: LooseRow;
        Update: LooseRow;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

export type LooseClient = SupabaseClient<LooseSchema, 'public'>;

/**
 * View an existing client through {@link LooseSchema}.
 *
 * Prefer this over `fromTable()` whenever the result is consumed rather than
 * immediately discarded — `fromTable` returns `any`, which propagates out of
 * shared helpers and silently un-types unrelated call sites.
 */
export function looseClient(sb: AnySupabaseClient): LooseClient {
  return sb as unknown as LooseClient;
}

/**
 * Structural view of the PostgREST filter methods that helpers chain.
 *
 * Helpers which *receive and return* a query builder (`applyProjectQueryFilters`,
 * `buildQuery`) can't name the builder's concrete type — it carries the schema,
 * the table, and the parsed `select()` string as type arguments. Declaring the
 * parameter as `B extends FilterChain<B>` keeps the caller's exact builder type
 * flowing through the helper instead of widening it.
 */
export type FilterChain<B> = {
  eq(column: string, value: unknown): B;
  neq(column: string, value: unknown): B;
  in(column: string, values: readonly unknown[]): B;
  not(column: string, operator: string, value: unknown): B;
  gte(column: string, value: unknown): B;
  lte(column: string, value: unknown): B;
  or(filters: string): B;
  order(column: string, options?: { ascending?: boolean }): B;
  limit(count: number): B;
};

/**
 * Call `supabase.from(table)` with a dynamic table name.
 * Returns an untyped query builder so callers don't need individual `as any` casts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the ONE audited escape hatch for dynamic table names (see file header); prefer looseClient()
export function fromTable(sb: AnySupabaseClient, table: string): any {
  return sb.from(table);
}

/**
 * Call `supabase.rpc(fn, params, options)` with a dynamic function name.
 * `options` forwards PostgREST modifiers like `{ count: 'exact', head: true }`.
 * Returns an untyped result so callers don't need individual `as any` casts.
 */
export function callRpc(
  sb: AnySupabaseClient,
  fn: string,
  params?: Record<string, unknown>,
  options?: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the ONE audited escape hatch for dynamic RPC names (see file header)
): any {
  return sb.rpc(fn as never, params as never, options as never);
}
