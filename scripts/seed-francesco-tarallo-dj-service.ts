/**
 * Seed Francesco Tarallo's "DJing & Music Production" service on OrangeCat.
 *
 * A service is someone's time and skill for sale, so it hangs off the SELLER's
 * actor and is paid into the SELLER's wallet. This script therefore refuses to
 * run until an actor for him exists — it will not quietly park another
 * person's income on the founder's identity.
 *
 * The copy, category, rate and links are the SSOT in
 * src/config/francesco-tarallo-dj-service.ts. This script only writes it.
 *
 * Idempotent: upserts by (actor_id, title), never truncates. Safe to re-run
 * after editing the config. Owner-gated so it can't fire by accident.
 *
 * Run against the LIVE self-hosted DB (supabase.orangecat.ch) from the box:
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/seed-francesco-tarallo-dj-service.ts
 *
 * Requires in the environment (already in .env.local on the box):
 *   NEXT_PUBLIC_SUPABASE_URL   — self-hosted Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role (bypasses RLS for the seed)
 * Optional:
 *   SERVICE_ACTOR_SLUG         — override the seller's actor slug
 *   NEXT_PUBLIC_SITE_URL       — public app origin (for the printed URL)
 *
 * Created: 2026-09-17
 */

import { die, requireOwnerAdminClient } from './lib/owner-gate';
import {
  PRICE_IS_PLACEHOLDER,
  SERVICE_ACTOR_SLUG,
  SERVICE_PAYLOAD,
} from '../src/config/francesco-tarallo-dj-service';

const admin = requireOwnerAdminClient();

const ACTOR_SLUG = process.env.SERVICE_ACTOR_SLUG || SERVICE_ACTOR_SLUG;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://orangecat.ch').replace(/\/+$/, '');

interface ActorRow {
  id: string;
  user_id: string | null;
}

/**
 * Resolve the SELLER's actor. Failing here is the correct outcome when he has
 * no account yet: the fix is for him to sign up, not for us to pick a
 * different owner.
 */
async function resolveSellerActor(): Promise<ActorRow> {
  const { data, error } = await admin
    .from('actors')
    .select('id, user_id')
    .eq('slug', ACTOR_SLUG)
    .maybeSingle();
  if (error) die(`Failed to resolve actor '${ACTOR_SLUG}': ${error.message}`);
  if (!data) {
    die(
      `No actor with slug '${ACTOR_SLUG}'.\n` +
        `    This service belongs to Francesco, not to whoever runs this script.\n` +
        `    Either have him sign up at ${SITE_URL} and claim that handle, or\n` +
        `    re-run with SERVICE_ACTOR_SLUG=<his actual slug>.`
    );
  }
  if (!data.user_id) die(`Actor '${ACTOR_SLUG}' has no user_id; services require one.`);
  return data as ActorRow;
}

/**
 * Warn (don't fail) if the seller has no active wallet. The service can exist
 * without one, but there is nowhere for a student's payment to land until he
 * connects one.
 */
async function checkSellerWallet(actor: ActorRow): Promise<void> {
  const { data, error } = await admin
    .from('wallets')
    .select('id')
    .eq('profile_id', actor.user_id)
    .eq('is_active', true);
  if (error) {
    console.warn(`  ⚠ could not verify seller wallet: ${error.message}`);
    return;
  }
  if (!data || data.length === 0) {
    console.warn(
      `  ⚠ SELLER HAS NO ACTIVE WALLET — students cannot pay until he connects\n` +
        `    one on OrangeCat for actor '${ACTOR_SLUG}'.`
    );
    return;
  }
  console.log(`  ✓ seller wallet present (${data.length} active)`);
}

/** Find a service owned by the actor with the given title (null if absent). */
async function findService(actorId: string, title: string): Promise<string | null> {
  const { data, error } = await admin
    .from('user_services')
    .select('id')
    .eq('actor_id', actorId)
    .eq('title', title)
    .maybeSingle();
  if (error) die(`Failed to look up service '${title}': ${error.message}`);
  return data?.id ?? null;
}

/** Upsert the service by (actor_id, title). Returns its id. */
async function upsertService(actor: ActorRow): Promise<string> {
  const row = {
    user_id: actor.user_id,
    actor_id: actor.id,
    title: SERVICE_PAYLOAD.title,
    description: SERVICE_PAYLOAD.description,
    category: SERVICE_PAYLOAD.category,
    hourly_rate: SERVICE_PAYLOAD.hourly_rate,
    currency: SERVICE_PAYLOAD.currency,
    duration_minutes: SERVICE_PAYLOAD.duration_minutes,
    service_location_type: SERVICE_PAYLOAD.service_location_type,
    service_area: SERVICE_PAYLOAD.service_area,
    portfolio_links: SERVICE_PAYLOAD.portfolio_links,
    show_on_profile: SERVICE_PAYLOAD.show_on_profile,
    status: SERVICE_PAYLOAD.status,
    is_test: false,
  };

  const existingId = await findService(actor.id, SERVICE_PAYLOAD.title);
  if (existingId) {
    const { error } = await admin.from('user_services').update(row).eq('id', existingId);
    if (error) die(`Failed to update '${SERVICE_PAYLOAD.title}': ${error.message}`);
    console.log(`↻ updated service "${SERVICE_PAYLOAD.title}" (${existingId})`);
    return existingId;
  }

  const { data, error } = await admin.from('user_services').insert(row).select('id').single();
  if (error) die(`Failed to insert '${SERVICE_PAYLOAD.title}': ${error.message}`);
  console.log(`+ created service "${SERVICE_PAYLOAD.title}" (${data.id})`);
  return data.id as string;
}

async function main(): Promise<void> {
  console.log(`Seeding Francesco Tarallo's service against ${admin.supabaseUrl} …`);
  const actor = await resolveSellerActor();
  console.log(`seller actor '${ACTOR_SLUG}' = ${actor.id}`);
  await checkSellerWallet(actor);

  const id = await upsertService(actor);

  console.log(`\n✓ done. ${SITE_URL}/services/${id}`);
  if (SERVICE_PAYLOAD.status === 'draft') {
    console.log(
      '\n⚠ Status is DRAFT — it is not public yet, by design.' +
        (PRICE_IS_PLACEHOLDER
          ? `\n  The rate (${SERVICE_PAYLOAD.currency} ${SERVICE_PAYLOAD.hourly_rate}/h) is a ` +
            'PLACEHOLDER, not his quote.\n  Confirm it with him, set the real rate in ' +
            "src/config/francesco-tarallo-dj-service.ts,\n  flip status to 'active', re-run."
          : '')
    );
  }
}

main().catch(err => die(err instanceof Error ? err.message : String(err)));
