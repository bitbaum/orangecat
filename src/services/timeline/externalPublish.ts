/**
 * External publish bus — server-side ingest.
 *
 * Lands an external client's (Loki) build event onto a project's OrangeCat
 * wall (timeline_events). Called only from POST /api/v1/timeline/publish after
 * the caller is authenticated (OIDC bearer / integration key) and scope-gated to
 * `timeline.write`.
 *
 * Why the admin client + app-layer authz: OIDC/integration-key callers are not a
 * Supabase session, so RLS's `auth.uid()` is null and the table's INSERT policy
 * can't apply. We therefore use the service-role client and enforce ownership
 * here in code (the platform's authz SSOT), exactly mirroring the rest of the v1
 * non-session data path.
 *
 * Idempotent + reconcilable: keyed by (metadata.source, metadata.external_id).
 * A repeat publish UPDATES the same row; a first publish INSERTs. The partial
 * unique index from migration 20260617000004 is the race backstop — a concurrent
 * double-publish loses the INSERT with 23505 and we fall back to UPDATE.
 *
 * NB: timeline_events.actor_id stores the USER id (the INSERT RLS policy compares
 * it to auth.uid()), despite the column name — see the home-feed work.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { getTableName } from '@/config/entity-registry';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { EXTERNAL_PUBLISH_META, type ExternalPublishInput } from '@/config/external-publish';

function adminDb(): AnySupabaseClient {
  return createAdminClient() as unknown as AnySupabaseClient;
}

const TABLE = 'timeline_events';

export type IngestResult =
  | { ok: true; status: 'created' | 'updated'; eventId: string }
  | { ok: false; reason: 'subject_not_found' | 'forbidden' | 'error'; message: string };

interface ExistingRow {
  id: string;
  actor_id: string | null;
}

/** Find a prior publish of this exact source event (the dedup lookup). */
async function findExisting(
  db: AnySupabaseClient,
  source: string,
  externalId: string
): Promise<ExistingRow | null> {
  const { data } = await db
    .from(TABLE)
    .select('id, actor_id')
    .eq(`metadata->>${EXTERNAL_PUBLISH_META.source}`, source)
    .eq(`metadata->>${EXTERNAL_PUBLISH_META.externalId}`, externalId)
    .maybeSingle();
  return (data as ExistingRow | null) ?? null;
}

/**
 * Verify the caller owns the subject project. Ownership is by `projects.user_id`
 * (the platform authz SSOT used by project_roles RLS), not actor_id.
 */
async function assertOwnsProject(
  db: AnySupabaseClient,
  projectId: string,
  userId: string
): Promise<'ok' | 'subject_not_found' | 'forbidden'> {
  const { data } = await db
    .from(getTableName('project'))
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!data) {
    return 'subject_not_found';
  }
  return (data as { user_id: string | null }).user_id === userId ? 'ok' : 'forbidden';
}

export async function ingestExternalEvent(
  input: ExternalPublishInput,
  userId: string
): Promise<IngestResult> {
  const db = adminDb();

  // Authz: only publish to a project the caller owns. (subject_type is allow-listed
  // to 'project' by the inbound schema.)
  const ownership = await assertOwnsProject(db, input.subject_id, userId);
  if (ownership !== 'ok') {
    return {
      ok: false,
      reason: ownership,
      message:
        ownership === 'subject_not_found'
          ? 'Subject project not found'
          : 'You do not own the subject project',
    };
  }

  const metadata: Record<string, unknown> = {
    [EXTERNAL_PUBLISH_META.source]: input.source,
    [EXTERNAL_PUBLISH_META.externalId]: input.external_id,
    [EXTERNAL_PUBLISH_META.isExternal]: true,
    ...(input.url ? { [EXTERNAL_PUBLISH_META.sourceUrl]: input.url } : {}),
  };

  // Fields a re-publish is allowed to reconcile (everything the source controls).
  const mutableFields = {
    event_type: input.event_type,
    title: input.title,
    description: input.description ?? null,
    content: input.content ?? {},
    tags: input.tags ?? [],
    visibility: input.visibility,
    metadata,
    ...(input.event_timestamp ? { event_timestamp: input.event_timestamp } : {}),
  };

  const existing = await findExisting(db, input.source, input.external_id);
  if (existing) {
    // Guard against a source reusing an external_id across users (would otherwise
    // let one user overwrite another's wall post via the global dedup key).
    if (existing.actor_id && existing.actor_id !== userId) {
      return { ok: false, reason: 'forbidden', message: 'external_id belongs to another actor' };
    }
    return updateExisting(db, existing.id, mutableFields);
  }

  // First publish — INSERT, with the unique index as the concurrent-publish backstop.
  const insertRow = {
    actor_id: userId,
    actor_type: 'user',
    subject_type: input.subject_type,
    subject_id: input.subject_id,
    ...mutableFields,
  };
  const { data, error } = await db.from(TABLE).insert(insertRow).select('id').single();

  if (error) {
    // Lost the INSERT race (someone published the same event concurrently) →
    // reconcile by updating the row they just created.
    if (error.code === '23505') {
      const racedWinner = await findExisting(db, input.source, input.external_id);
      if (racedWinner) {
        return updateExisting(db, racedWinner.id, mutableFields);
      }
    }
    logger.error('External publish insert failed', { error: error.message }, 'ExternalPublish');
    return { ok: false, reason: 'error', message: error.message };
  }

  return { ok: true, status: 'created', eventId: (data as { id: string }).id };
}

async function updateExisting(
  db: AnySupabaseClient,
  eventId: string,
  fields: Record<string, unknown>
): Promise<IngestResult> {
  const { error } = await db
    .from(TABLE)
    .update({ ...fields, is_deleted: false, deleted_at: null })
    .eq('id', eventId);
  if (error) {
    logger.error('External publish update failed', { error: error.message }, 'ExternalPublish');
    return { ok: false, reason: 'error', message: error.message };
  }
  return { ok: true, status: 'updated', eventId };
}
