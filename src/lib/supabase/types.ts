import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared Supabase type aliases.
 *
 * AnySupabaseClient is used throughout service and API layers where the
 * caller may pass either a server client (SupabaseClient<Database>) or a
 * browser client, and where the table schema is not yet fully typed in
 * database.ts. Using a single export here prevents the same type alias
 * from being redefined in every service file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the ONE audited escape hatch for clients of either schema (see doc above)
export type AnySupabaseClient = SupabaseClient<any, any, any>;
