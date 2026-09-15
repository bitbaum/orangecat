/**
 * The preamble every owner-gated operational script shares.
 *
 * Five scripts (seed-loki-passes, seed-revive-my-old-ride,
 * solon/seed-genesis-policy, solon/pin-trusted-keys, oauth/register-client)
 * each opened with the same thirty lines: load .env.local, read the service
 * role key, refuse to run without ORANGECAT_OWNER_SEED=1, build an admin
 * client. These scripts run against the LIVE self-hosted database with a key
 * that bypasses RLS, so the gate is the only thing standing between a stray
 * `npx tsx` and production — which is precisely the kind of check that must
 * not exist in five versions, one of which might one day be written slightly
 * differently.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

/** Print the failure the way these scripts print it, and stop. */
export function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/**
 * Refuse unless the operator asked for this explicitly, then hand back a
 * service-role client. Call it at module top level, exactly as the inline
 * version ran: the process exits before anything else is evaluated.
 */
export function requireOwnerAdminClient(): SupabaseClient & { supabaseUrl: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (process.env.ORANGECAT_OWNER_SEED !== '1') {
    die('Refusing to run without ORANGECAT_OWNER_SEED=1 (owner-gated).');
  }
  if (!supabaseUrl || !serviceRoleKey) {
    die('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Scripts print which database they are about to write to. That is worth
  // keeping — it is the last chance to notice you are pointed at production.
  return Object.assign(client, { supabaseUrl });
}
