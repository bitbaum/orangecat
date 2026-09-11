/**
 * Register an OIDC relying party in `public.oauth_clients` — OIDC provider slice 1d.
 *
 * OrangeCat is the platform's OAuth2/OIDC authorization server ("Login with
 * OrangeCat"). The provider code (slices 1a–1c) is inert until a client row
 * exists; this script creates / updates that row. Registered relying parties
 * live in CLIENT_SPECS below — one least-privilege SSOT per client.
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
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client fleetcrown
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client solon
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/oauth/register-client.ts --client solon --rotate
 * (no --client defaults to fleetcrown, preserving the original invocation)
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

import { config as loadEnv } from 'dotenv';
import { createHash, randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseAndValidateScopes } from '../../src/lib/oauth/config';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (process.env.ORANGECAT_OWNER_SEED !== '1') {
  die('Refusing to run without ORANGECAT_OWNER_SEED=1 (owner-gated).');
}
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  die('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.');
}

const rotate = process.argv.includes('--rotate');
const clientArgIdx = process.argv.indexOf('--client');
const clientId = (clientArgIdx !== -1 && process.argv[clientArgIdx + 1]) || 'fleetcrown';
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Auth.js v5 callback path — identical for every relying party we register. */
const CALLBACK_PATH = '/api/auth/callback/orangecat';

interface ClientSpec {
  name: string;
  /** Production origins; the callback path is appended to each. */
  origins: string[];
  /** Space-separated scope ceiling — validated against the scope registry. */
  scopes: string;
  is_confidential: boolean;
  is_trusted: boolean;
}

/**
 * The registered relying parties — one least-privilege SSOT per client.
 *
 * - scopes: only what the client actually needs today. NOT the full supported
 *   set — `effectiveScopes()` narrows per-request, but the *ceiling* stays
 *   minimal so a token can never be minted for a capability the client
 *   shouldn't have. Widen here intentionally (and re-run) when one needs a
 *   new capability.
 * - origins: exact-match redirect enforcement (no wildcards). Append
 *   dev/preview origins via <ID>_REDIRECT_URIS when needed.
 */
const CLIENT_SPECS: Record<string, ClientSpec> = {
  // Mirrors the row first registered + go-live-verified on 2026-06-17; the
  // secret already lives in FleetCrown's env.
  fleetcrown: {
    name: 'FleetCrown',
    origins: ['https://fleetcrown.orangecat.ch'], // production origin (PLATFORM_AND_COLLABORATION.md)
    scopes: 'openid profile email project.read project.write timeline.write wallet.read',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
  // Solon needs IDENTITY and nothing else: login links a Solon member to an
  // OrangeCat actor (Member.ocActorId). It never acts on OrangeCat's behalf —
  // governance authority flows the other way, through Bitcoin-signed votes
  // that OrangeCat re-verifies (src/services/solon/decision-verify.ts).
  solon: {
    name: 'Solon',
    origins: ['https://solon.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true,
    is_trusted: true,
  },
  // Heidi needs IDENTITY and nothing else, for the same reason Solon does.
  // Heidi teaches Swiss German; its portal has learners, tutors who can be
  // paid, and study groups — and each of those is something OrangeCat already
  // owns (identity, economy, public presence). So Heidi keeps NO users table
  // and acts on nobody's behalf: it reads who you are and stops there.
  // Widen this ceiling deliberately, here, if tutor payouts later need a
  // wallet scope — never by letting the client ask for more at request time.
  heidi: {
    name: 'Heidi',
    origins: ['https://heidi.orangecat.ch'],
    scopes: 'openid profile email',
    is_confidential: true, // has a server (Auth.js v5) — keeps a secret
    is_trusted: true, // first-party — skips the consent screen after first grant
  },
};

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
} as const;

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
