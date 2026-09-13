/**
 * Seed the three Loki passes as Bitcoin-payable OrangeCat products.
 *
 * Loki sells its paid plans (personal/pro/team) as OrangeCat `products`
 * tagged for the entitlement rail. When a buyer pays one in BTC and the payment
 * settles, notifyLokiEntitlement() signals Loki to grant the plan
 * (src/services/loki/entitlement-notify.ts). The catalogue + tag format
 * are the SSOT in src/config/loki-passes.ts — this script only writes it
 * to the DB.
 *
 * Idempotent: upsert by (actor_id, title); never truncates. Owner-gated so it
 * can't fire by accident. Prints the three checkout URLs to configure on the
 * Loki box (ORANGECAT_PAY_URL_*).
 *
 * Run against the LIVE self-hosted DB (supabase.orangecat.ch) from the box:
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/seed-loki-passes.ts
 *
 * Requires in the environment (already in .env.local on the box):
 *   NEXT_PUBLIC_SUPABASE_URL   — self-hosted Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role (bypasses RLS for the seed)
 *   NEXT_PUBLIC_SITE_URL       — public app origin (for the checkout URLs)
 *
 * Created: 2026-07-22
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  LOKI_PASSES,
  OWNER_ACTOR_SLUG,
  type LokiPass,
} from '../src/config/loki-passes';

loadEnv({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://orangecat.ch').replace(/\/+$/, '');

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

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface ActorRow {
  id: string;
  user_id: string | null;
}

async function resolveOwnerActor(): Promise<ActorRow> {
  const { data, error } = await admin
    .from('actors')
    .select('id, user_id')
    .eq('slug', OWNER_ACTOR_SLUG)
    .maybeSingle();
  if (error) die(`Failed to resolve owner actor: ${error.message}`);
  if (!data) die(`No actor with slug '${OWNER_ACTOR_SLUG}'. Create it or change OWNER_ACTOR_SLUG.`);
  if (!data.user_id) die(`Actor '${OWNER_ACTOR_SLUG}' has no user_id; products require one.`);
  return data as ActorRow;
}

/**
 * Warn (don't fail) if the seller actor has no active wallet. The pass products
 * can exist without one, but checkout will fail with "Seller has no wallet
 * connected" until a wallet is connected on OrangeCat for this actor.
 */
async function checkSellerWallet(actor: ActorRow): Promise<void> {
  const { data, error } = await admin
    .from('wallets')
    .select('id, is_active')
    .eq('profile_id', actor.user_id)
    .eq('is_active', true);
  if (error) {
    console.warn(`  ⚠ could not verify seller wallet: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    console.warn(
      `  ⚠ SELLER HAS NO ACTIVE WALLET — buyers cannot pay until one is connected\n` +
        `    on OrangeCat for actor '${OWNER_ACTOR_SLUG}'. The passes will exist but\n` +
        `    checkout fails with "Seller has no wallet connected".`
    );
  } else {
    console.log(`  ✓ seller wallet present (${data.length} active)`);
  }
}

/** Find a product owned by the actor with the given title (null if absent). */
async function findProduct(actorId: string, title: string): Promise<string | null> {
  const { data, error } = await admin
    .from('user_products')
    .select('id')
    .eq('actor_id', actorId)
    .eq('title', title)
    .maybeSingle();
  if (error) die(`Failed to look up product '${title}': ${error.message}`);
  return data?.id ?? null;
}

/** Upsert one pass product by (actor_id, title). Returns its id. */
async function upsertPass(actor: ActorRow, pass: LokiPass): Promise<string> {
  const row = {
    user_id: actor.user_id,
    actor_id: actor.id,
    title: pass.title,
    description: pass.description,
    // price null = "to be announced": pause the pass so nothing can be bought
    // at a stale price (user_products_price_check forbids 0) and leave the
    // stored price column untouched. An announced price re-activates it.
    ...(pass.price === null ? {} : { price: pass.price }),
    currency: pass.currency,
    product_type: 'digital',
    status: pass.price === null ? 'paused' : 'active',
    show_on_profile: false, // reached from Loki's /pricing, not browsed on OC
    tags: pass.tags,
    is_test: false,
  };

  const existingId = await findProduct(actor.id, pass.title);
  if (existingId) {
    const { error } = await admin.from('user_products').update(row).eq('id', existingId);
    if (error) die(`Failed to update '${pass.title}': ${error.message}`);
    console.log(`↻ updated ${pass.plan} pass "${pass.title}" (${existingId})`);
    return existingId;
  }

  const { data, error } = await admin.from('user_products').insert(row).select('id').single();
  if (error) die(`Failed to insert '${pass.title}': ${error.message}`);
  console.log(`+ created ${pass.plan} pass "${pass.title}" (${data.id})`);
  return data.id as string;
}

async function main(): Promise<void> {
  console.log(`Seeding Loki passes against ${SUPABASE_URL} …`);
  const actor = await resolveOwnerActor();
  console.log(`owner actor '${OWNER_ACTOR_SLUG}' = ${actor.id}`);
  await checkSellerWallet(actor);

  const envLines: string[] = [];
  for (const pass of LOKI_PASSES) {
    const id = await upsertPass(actor, pass);
    envLines.push(`ORANGECAT_PAY_URL_${pass.plan.toUpperCase()}=${SITE_URL}/products/${id}`);
  }

  console.log('\n✓ done.\n');
  console.log('Set these on the Loki box (.env) so /pricing lights up "Pay in Bitcoin":\n');
  for (const line of envLines) {
    console.log(`  ${line}`);
  }
  console.log(
    '\nAlso set ORANGECAT_WEBHOOK_SECRET to the SAME value on BOTH the OrangeCat and\n' +
      'Loki boxes — until then the settlement → grant webhook stays inert\n' +
      '(both ends fail closed by design).'
  );
}

main().catch(err => die(err instanceof Error ? err.message : String(err)));
