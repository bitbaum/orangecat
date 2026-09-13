/**
 * Seed "Revive My Old Ride" as an OrangeCat project + stakeholder edges.
 *
 * OrangeCat is the SSOT for economic entities (projects) and the cross-product
 * stakeholder graph. This registers the revamp-it initiative the Loki
 * session built — but on the correct (economic) layer.
 *
 * Idempotent: resolves the owner actor and sibling projects by stable
 * identifiers at runtime, upserts by (actor_id, title), and never truncates.
 * Safe to re-run. Owner-gated so it can't fire by accident.
 *
 * Run against the LIVE self-hosted DB (supabase.orangecat.ch) from the box:
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/seed-revive-my-old-ride.ts
 *
 * Requires in the environment (already in .env.local on the box):
 *   NEXT_PUBLIC_SUPABASE_URL   — self-hosted Supabase URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service role (bypasses RLS for the seed)
 *
 * Created: 2026-06-15
 */

import { config as loadEnv } from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  OWNER_ACTOR_SLUG,
  PROJECT_PAYLOAD,
  STAKEHOLDER_EDGES,
  type StakeholderEdgeSpec,
} from '../src/config/revive-my-old-ride';

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
  if (!data.user_id) die(`Actor '${OWNER_ACTOR_SLUG}' has no user_id; projects require one.`);
  return data as ActorRow;
}

/** Find a project owned by the actor with the given title (null if absent). */
async function findProject(actorId: string, title: string): Promise<string | null> {
  const { data, error } = await admin
    .from('projects')
    .select('id')
    .eq('actor_id', actorId)
    .eq('title', title)
    .maybeSingle();
  if (error) die(`Failed to look up project '${title}': ${error.message}`);
  return data?.id ?? null;
}

/** Upsert the Revive project by (actor_id, title). Returns its id. */
async function upsertReviveProject(actor: ActorRow): Promise<string> {
  const existingId = await findProject(actor.id, PROJECT_PAYLOAD.title);
  const row = {
    user_id: actor.user_id,
    actor_id: actor.id,
    creator_id: actor.user_id,
    title: PROJECT_PAYLOAD.title,
    description: PROJECT_PAYLOAD.description,
    category: PROJECT_PAYLOAD.category,
    currency: PROJECT_PAYLOAD.currency,
    status: PROJECT_PAYLOAD.status,
    tags: PROJECT_PAYLOAD.tags,
    funding_purpose: PROJECT_PAYLOAD.funding_purpose,
    website_url: PROJECT_PAYLOAD.website_url,
    is_test: false,
  };

  if (existingId) {
    const { error } = await admin.from('projects').update(row).eq('id', existingId);
    if (error) die(`Failed to update project: ${error.message}`);
    console.log(`↻ updated project "${PROJECT_PAYLOAD.title}" (${existingId})`);
    return existingId;
  }

  const { data, error } = await admin.from('projects').insert(row).select('id').single();
  if (error) die(`Failed to insert project: ${error.message}`);
  console.log(`+ created project "${PROJECT_PAYLOAD.title}" (${data.id})`);
  return data.id as string;
}

/** Idempotently create one stakeholder edge from the Revive project. */
async function upsertEdge(
  ownerActorId: string,
  fromProjectId: string,
  edge: StakeholderEdgeSpec
): Promise<void> {
  // Resolve the target — either a sibling project or an external link.
  let toProjectId: string | null = null;
  if (edge.toProjectTitle) {
    toProjectId = await findProject(ownerActorId, edge.toProjectTitle);
    if (!toProjectId) {
      console.warn(
        `  ⚠ skip ${edge.kind} edge — sibling project "${edge.toProjectTitle}" not found`
      );
      return;
    }
  }

  // Idempotency: match on (from, kind, target).
  let probe = admin
    .from('stakeholder_relationships')
    .select('id')
    .eq('from_project_id', fromProjectId)
    .eq('kind', edge.kind);
  probe = toProjectId
    ? probe.eq('to_project_id', toProjectId)
    : probe.eq('to_external_url', edge.toExternalUrl ?? '');
  const { data: existing, error: probeErr } = await probe.maybeSingle();
  if (probeErr) die(`Failed to probe edge (${edge.kind}): ${probeErr.message}`);

  const row = {
    owner_actor_id: ownerActorId,
    from_project_id: fromProjectId,
    kind: edge.kind,
    to_project_id: toProjectId,
    to_actor_id: null,
    to_external_url: toProjectId ? null : (edge.toExternalUrl ?? null),
    to_external_name: toProjectId ? null : (edge.toExternalName ?? null),
    notes: edge.notes,
    status: 'active',
    metadata: {},
  };

  const target = edge.toProjectTitle ?? edge.toExternalName ?? edge.toExternalUrl ?? '?';
  if (existing) {
    const { error } = await admin
      .from('stakeholder_relationships')
      .update(row)
      .eq('id', existing.id);
    if (error) die(`Failed to update edge (${edge.kind} → ${target}): ${error.message}`);
    console.log(`  ↻ edge ${edge.kind} → ${target}`);
    return;
  }
  const { error } = await admin.from('stakeholder_relationships').insert(row);
  if (error) die(`Failed to insert edge (${edge.kind} → ${target}): ${error.message}`);
  console.log(`  + edge ${edge.kind} → ${target}`);
}

async function main(): Promise<void> {
  console.log(`Seeding "Revive My Old Ride" against ${SUPABASE_URL} …`);
  const actor = await resolveOwnerActor();
  console.log(`owner actor '${OWNER_ACTOR_SLUG}' = ${actor.id}`);

  const reviveId = await upsertReviveProject(actor);

  console.log('stakeholder edges:');
  for (const edge of STAKEHOLDER_EDGES) {
    await upsertEdge(actor.id, reviveId, edge);
  }

  console.log('✓ done. View at /projects and /dashboard/projects.');
}

main().catch(err => die(err instanceof Error ? err.message : String(err)));
