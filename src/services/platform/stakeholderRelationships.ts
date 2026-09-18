/**
 * Stakeholder relationship domain service.
 *
 * Session callers use their Supabase client (RLS enforces ownership).
 * v1 integration-key callers use the admin client with explicit app-layer
 * authz — same pattern as externalPublish.ts (OIDC keys are not a session).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';
import { getTableName } from '@/config/entity-registry';
import {
  STAKEHOLDER_KINDS,
  type CreateStakeholderInput,
  isStakeholderKind,
} from '@/config/stakeholders';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { logger } from '@/utils/logger';
import { getUserActorId } from '@/domain/actors';

export type StakeholderRow = Record<string, unknown> & { id: string };

type ListResult =
  | { ok: true; relationships: StakeholderRow[] }
  | {
      ok: false;
      reason: 'bad_kind' | 'project_not_found' | 'forbidden' | 'error';
      message: string;
    };

type CreateResult =
  | { ok: true; relationship: StakeholderRow }
  | {
      ok: false;
      reason: 'project_not_found' | 'forbidden' | 'no_actor' | 'error';
      message: string;
    };

function adminDb(): AnySupabaseClient {
  return createAdminClient() as unknown as AnySupabaseClient;
}

async function assertOwnsProject(
  db: AnySupabaseClient,
  projectId: string,
  userId: string
): Promise<'ok' | 'project_not_found' | 'forbidden'> {
  const { data } = await db
    .from(getTableName('project'))
    .select('user_id')
    .eq('id', projectId)
    .maybeSingle();
  if (!data) {
    return 'project_not_found';
  }
  return (data as { user_id: string | null }).user_id === userId ? 'ok' : 'forbidden';
}

async function resolveOwnerActorId(db: AnySupabaseClient, userId: string): Promise<string | null> {
  return getUserActorId(db, userId);
}

function buildInsertRow(ownerActorId: string, input: CreateStakeholderInput) {
  return {
    owner_actor_id: ownerActorId,
    from_project_id: input.fromProjectId,
    kind: input.kind,
    to_actor_id: input.toActorId ?? null,
    to_project_id: input.toProjectId ?? null,
    to_external_url: input.toExternalUrl ?? null,
    to_external_name: input.toExternalName ?? null,
    status: input.status ?? null,
    confidence: input.confidence ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  };
}

/** List relationships for a project (session path — RLS is authoritative). */
export async function listStakeholderRelationships(
  supabase: AnySupabaseClient,
  fromProjectId: string,
  kindFilter?: string
): Promise<ListResult> {
  if (kindFilter && !isStakeholderKind(kindFilter)) {
    return {
      ok: false,
      reason: 'bad_kind',
      message: `kind must be one of: ${STAKEHOLDER_KINDS.join(', ')}`,
    };
  }

  let query = supabase
    .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
    .select('*')
    .eq('from_project_id', fromProjectId)
    .order('updated_at', { ascending: false });

  if (kindFilter) {
    query = query.eq('kind', kindFilter);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to list stakeholder relationships', error, 'StakeholderRelationships');
    return { ok: false, reason: 'error', message: 'Failed to load stakeholders' };
  }

  return { ok: true, relationships: (data ?? []) as StakeholderRow[] };
}

/** Create a relationship (session path — caller's supabase + explicit project check). */
export async function createStakeholderRelationship(
  supabase: AnySupabaseClient,
  ownerActorId: string,
  input: CreateStakeholderInput
): Promise<CreateResult> {
  const { data: projectRow, error: projectErr } = await supabase
    .from(getTableName('project'))
    .select('id, actor_id')
    .eq('id', input.fromProjectId)
    .maybeSingle();
  if (projectErr) {
    logger.error('Failed to verify project ownership', projectErr, 'StakeholderRelationships');
    return { ok: false, reason: 'error', message: 'Failed to verify project' };
  }
  if (!projectRow) {
    return { ok: false, reason: 'project_not_found', message: 'Project not found' };
  }
  if ((projectRow as { actor_id: string }).actor_id !== ownerActorId) {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'You can only add stakeholders to your own projects',
    };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
    .insert(buildInsertRow(ownerActorId, input))
    .select('*')
    .single();

  if (insertErr) {
    logger.error(
      'Failed to insert stakeholder relationship',
      insertErr,
      'StakeholderRelationships'
    );
    return { ok: false, reason: 'error', message: 'Failed to create stakeholder relationship' };
  }

  return { ok: true, relationship: inserted as StakeholderRow };
}

/** List relationships for a v1 caller (admin client + ownership check). */
export async function listStakeholderRelationshipsForUser(
  userId: string,
  fromProjectId: string,
  kindFilter?: string
): Promise<ListResult> {
  if (kindFilter && !isStakeholderKind(kindFilter)) {
    return {
      ok: false,
      reason: 'bad_kind',
      message: `kind must be one of: ${STAKEHOLDER_KINDS.join(', ')}`,
    };
  }

  const db = adminDb();
  const ownership = await assertOwnsProject(db, fromProjectId, userId);
  if (ownership === 'project_not_found') {
    return { ok: false, reason: 'project_not_found', message: 'Project not found' };
  }
  if (ownership === 'forbidden') {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'You can only list stakeholders for your own projects',
    };
  }

  let query = db
    .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
    .select('*')
    .eq('from_project_id', fromProjectId)
    .order('updated_at', { ascending: false });

  if (kindFilter) {
    query = query.eq('kind', kindFilter);
  }

  const { data, error } = await query;
  if (error) {
    logger.error(
      'Failed to list stakeholder relationships (v1)',
      error,
      'StakeholderRelationships'
    );
    return { ok: false, reason: 'error', message: 'Failed to load stakeholders' };
  }

  return { ok: true, relationships: (data ?? []) as StakeholderRow[] };
}

/** Create a relationship for a v1 caller (admin client + ownership check). */
export async function createStakeholderRelationshipForUser(
  userId: string,
  input: CreateStakeholderInput
): Promise<CreateResult> {
  const db = adminDb();
  const ownerActorId = await resolveOwnerActorId(db, userId);
  if (!ownerActorId) {
    return { ok: false, reason: 'no_actor', message: 'No actor associated with this user' };
  }

  const ownership = await assertOwnsProject(db, input.fromProjectId, userId);
  if (ownership === 'project_not_found') {
    return { ok: false, reason: 'project_not_found', message: 'Project not found' };
  }
  if (ownership === 'forbidden') {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'You can only add stakeholders to your own projects',
    };
  }

  const { data: projectRow } = await db
    .from(getTableName('project'))
    .select('actor_id')
    .eq('id', input.fromProjectId)
    .maybeSingle();
  if ((projectRow as { actor_id: string } | null)?.actor_id !== ownerActorId) {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'You can only add stakeholders to your own projects',
    };
  }

  const { data: inserted, error: insertErr } = await db
    .from(DATABASE_TABLES.STAKEHOLDER_RELATIONSHIPS)
    .insert(buildInsertRow(ownerActorId, input))
    .select('*')
    .single();

  if (insertErr) {
    logger.error(
      'Failed to insert stakeholder relationship (v1)',
      insertErr,
      'StakeholderRelationships'
    );
    return { ok: false, reason: 'error', message: 'Failed to create stakeholder relationship' };
  }

  return { ok: true, relationship: inserted as StakeholderRow };
}
