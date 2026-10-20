/**
 * Register an OIDC relying party in `public.oauth_clients` — OIDC provider slice 1d.
 *
 * OrangeCat is the platform's OAuth2/OIDC authorization server ("Login with
 * OrangeCat"). The provider code (slices 1a–1c) is inert until a client row
 * exists; this script creates / updates that row. Registered relying parties
 * live in CLIENT_SPECS (scripts/oauth/client-specs.ts) — one least-privilege SSOT per client.
 *
 * Secrets are NEVER committed: the client secret is read from env (or generated)
 * and only its sha256 hash is stored — mirroring integration_keys and the
 * oauth_provider migration. The plaintext is printed ONCE on creation so it can
 * be handed to the relying party out-of-band.
 *
 * Idempotent + safe to re-run:
 *   - upserts by the stable `client_id`;
 *   - refreshes non-secret fields (name, redirect_uris, allowed_scopes, flags)
 *     every run so config drift is corrected;
 *   - the secret is set on first creation and otherwise left untouched, UNLESS
 *     `--rotate` is passed (which mints a new secret and prints it).
 *
 * Run against the LIVE self-hosted DB (supabase.orangecat.ch) from the box:
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client loki
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client solon
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client solon --rotate
 * (no --client defaults to loki, preserving the original invocation)
 *
 * Requires in the environment (already in .env.local on the box):
 *   NEXT_PUBLIC_SUPABASE_URL   — self-hosted Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role (bypasses the table's RLS)
 * Optional, per client (<ID> = client id uppercased):
 *   <ID>_OAUTH_SECRET          — use a pre-agreed secret instead of generating one
 *   <ID>_REDIRECT_URIS         — comma-separated; ADDED to the built-in defaults
 *
 * Created: 2026-06-17
 */

import { die, requireOwnerAdminClient } from '../lib/owner-gate';
import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAndValidateScopes } from '../../src/lib/oauth/config';
import { CALLBACK_PATH, CLIENT_SPECS } from './client-specs';

const admin = requireOwnerAdminClient();

const rotate = process.argv.includes('--rotate');
const clientArgIdx = process.argv.indexOf('--client');
const clientId = (clientArgIdx !== -1 && process.argv[clientArgIdx + 1]) || 'loki';
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

const spec = CLIENT_SPECS[clientId];
if (!spec) {
  die(`Unknown client "${clientId}". Registered specs: ${Object.keys(CLIENT_SPECS).join(', ')}`);
}

const ENV_PREFIX = clientId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
const extraRedirects = (process.env[`${ENV_PREFIX}_REDIRECT_URIS`] ?? '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const redirectUris = Array.from(
  new Set([...spec.origins.map(o => `${o}${CALLBACK_PATH}`), ...extraRedirects])
);

// Validate against the OAuth scope registry SSOT so a typo can't register an
// unknown scope (parseAndValidateScopes drops unknowns into `.unknown`).
const { granted: allowedScopes, unknown: unknownScopes } = parseAndValidateScopes(spec.scopes);
if (unknownScopes.length) {
  die(`Unknown scope(s) for "${clientId}": ${unknownScopes.join(', ')}`);
}

const CLIENT = {
  client_id: clientId,
  name: spec.name,
  redirect_uris: redirectUris,
  allowed_scopes: allowedScopes,
  is_confidential: spec.is_confidential,
  is_trusted: spec.is_trusted,
  policy_uri: spec.policy_uri ?? null,
  tos_uri: spec.tos_uri ?? null,
} as const;

interface ClientRow {
  id: string;
  client_id: string;
  client_secret_hash: string | null;
  disabled_at: string | null;
}

async function run(): Promise<void> {
  const { data: existing, error: readErr } = await admin
    .from('oauth_clients')
    .select('id, client_id, client_secret_hash, disabled_at')
    .eq('client_id', CLIENT.client_id)
    .maybeSingle<ClientRow>();
  if (readErr) {
    die(`Failed to read oauth_clients: ${readErr.message}`);
  }

  // Decide the secret: keep existing unless creating or rotating.
  let newSecret: string | null = null;
  let secretHash: string | null = existing?.client_secret_hash ?? null;
  if (!existing || rotate) {
    newSecret = process.env[`${ENV_PREFIX}_OAUTH_SECRET`] || randomBytes(32).toString('base64url');
    secretHash = sha256(newSecret);
  }

  const row = {
    client_id: CLIENT.client_id,
    client_secret_hash: secretHash,
    name: CLIENT.name,
    redirect_uris: CLIENT.redirect_uris,
    allowed_scopes: CLIENT.allowed_scopes,
    is_confidential: CLIENT.is_confidential,
    is_trusted: CLIENT.is_trusted,
    policy_uri: CLIENT.policy_uri,
    tos_uri: CLIENT.tos_uri,
    disabled_at: null, // re-enable if it had been revoked
  };

  const { error: upsertErr } = await admin
    .from('oauth_clients')
    .upsert(row, { onConflict: 'client_id' });
  if (upsertErr) {
    die(`Failed to upsert oauth_clients: ${upsertErr.message}`);
  }

  const verb = existing ? (rotate ? 'updated + rotated secret for' : 'updated') : 'created';
  console.log(`✓ ${verb} OIDC client "${CLIENT.client_id}" (${CLIENT.name})`);
  console.log(`  redirect_uris : ${CLIENT.redirect_uris.join('\n                  ')}`);
  console.log(`  allowed_scopes: ${CLIENT.allowed_scopes.join(' ')}`);
  console.log(`  confidential  : ${CLIENT.is_confidential}   trusted: ${CLIENT.is_trusted}`);

  if (newSecret) {
    console.log('\n  ┌──────────────────────────────────────────────────────────────');
    console.log(`  │ CLIENT SECRET (shown ONCE — store in ${CLIENT.name}'s env now):`);
    console.log(`  │   client_id     = ${CLIENT.client_id}`);
    console.log(`  │   client_secret = ${newSecret}`);
    console.log('  └──────────────────────────────────────────────────────────────');
    if (process.env[`${ENV_PREFIX}_OAUTH_SECRET`]) {
      console.log(`  (used ${ENV_PREFIX}_OAUTH_SECRET from the environment)`);
    }
  } else {
    console.log('\n  Secret unchanged (pass --rotate to mint a new one).');
  }
}

run().catch(e => die(e instanceof Error ? e.message : String(e)));
