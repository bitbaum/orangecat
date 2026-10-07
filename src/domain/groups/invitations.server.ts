/**
 * Group invitation domain logic (server-only).
 *
 * The accept/decline/revoke business rules — membership checks, status
 * transitions, expiry, admin gating — live here so the API route stays a thin
 * validate → delegate → respond wrapper. Each function returns a discriminated
 * result the route maps to an HTTP response (no HTTP concerns in this layer).
 */

import { DATABASE_TABLES } from '@/config/database-tables';
import { STATUS } from '@/config/database-constants';
import { checkGroupAdmin, resolveGroupBySlug } from '@/domain/groups/helpers.server';
import { logger } from '@/utils/logger';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/constants/pagination';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { getAdminClient } from '@/lib/supabase/admin';
import { NotificationService } from '@/lib/services/notifications';
import { ROUTES } from '@/config/routes';

/** Outcome codes the route maps to apiForbidden / apiNotFound / apiValidationError. */
export type InvitationErrorCode = 'not_found' | 'forbidden' | 'invalid';

export type InvitationResult =
  | { ok: true; message: string; group_slug?: string }
  | { ok: false; code: InvitationErrorCode; message: string }
  | { ok: false; dbError: unknown };

/** Generic discriminated result for the list/create collection operations. */
export type InvitationCollectionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: InvitationErrorCode; message: string }
  | { ok: false; dbError: unknown };

/** Validated create-invitation input (shape mirrors the route's zod schema). */
export type CreateInvitationInput = {
  /** The person invited. Link and e-mail invitations were never deliverable
   *  (no join page, no mail) and are not offered. */
  user_id: string;
  role: 'admin' | 'member';
  message?: string;
  expires_in_days: number;
};

/**
 * Accept or decline an invitation addressed to `userId`.
 *
 * Through the database functions, which run as definer: accepting adds the
 * invitee to group_members, and group_members' own policy lets only admins
 * insert — so the multi-step version here could never succeed. The functions
 * answer "not found" alike for a missing id and someone else's, and lock the
 * row, so two taps cannot both win.
 */
export async function respondToInvitation(
  supabase: AnySupabaseClient,
  invitationId: string,
  _userId: string,
  action: 'accept' | 'decline'
): Promise<InvitationResult> {
  const fn = action === 'accept' ? 'accept_group_invitation' : 'decline_group_invitation';
  const { data, error } = await supabase.rpc(fn, { invitation_id: invitationId });
  if (error) {
    return { ok: false, dbError: error };
  }
  const result = (data ?? {}) as { success?: boolean; error?: string; group_id?: string };
  if (!result.success) {
    // The RPC's own jsonb, not the API envelope: `error` is a sentence here.
    const message =
      typeof result.error === 'string' && result.error ? result.error : 'Invitation not found';
    return {
      ok: false,
      code: message === 'Invitation not found' ? 'not_found' : 'invalid',
      message,
    };
  }
  if (action === 'decline') {
    return { ok: true, message: 'Invitation declined' };
  }
  // A member now, so the group — public or private — is readable.
  const { data: group } = await supabase
    .from(DATABASE_TABLES.GROUPS)
    .select('slug')
    .eq('id', result.group_id)
    .maybeSingle();
  return {
    ok: true,
    message: 'You joined the group',
    group_slug: (group as { slug?: string } | null)?.slug,
  };
}

/** What the invitee sees before answering: who asked, into what. */
export type InvitationForInvitee = {
  id: string;
  status: string;
  role: string;
  message: string | null;
  expires_at: string;
  group: { name: string; slug: string; description: string | null } | null;
  inviter: { name: string } | null;
};

/**
 * An invitation as its invitee may see it. The row is read with the caller's
 * own client (RLS: "Users can view their invitations"), which is the proof it
 * is theirs; only then is the group — which may be private and so unreadable
 * to a non-member — fetched with the service role.
 */
export async function getInvitationForInvitee(
  supabase: AnySupabaseClient,
  admin: AnySupabaseClient,
  invitationId: string,
  userId: string
): Promise<InvitationForInvitee | null> {
  const { data: inv } = await supabase
    .from(DATABASE_TABLES.GROUP_INVITATIONS)
    .select('id, status, role, message, expires_at, group_id, invited_by, user_id')
    .eq('id', invitationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!inv) {
    return null;
  }
  const row = inv as {
    id: string;
    status: string;
    role: string;
    message: string | null;
    expires_at: string;
    group_id: string;
    invited_by: string;
  };
  const [{ data: group }, { data: inviter }] = await Promise.all([
    admin
      .from(DATABASE_TABLES.GROUPS)
      .select('name, slug, description')
      .eq('id', row.group_id)
      .maybeSingle(),
    admin
      .from(DATABASE_TABLES.PROFILES)
      .select('name, username')
      .eq('id', row.invited_by)
      .maybeSingle(),
  ]);
  const who = inviter as { name?: string | null; username?: string | null } | null;
  return {
    id: row.id,
    status: row.status,
    role: row.role,
    message: row.message,
    expires_at: row.expires_at,
    group: (group as InvitationForInvitee['group']) ?? null,
    inviter: who ? { name: who.name || (who.username ? `@${who.username}` : 'Someone') } : null,
  };
}

/** Revoke a pending invitation (group admins only). */
export async function revokeInvitation(
  supabase: AnySupabaseClient,
  invitationId: string,
  userId: string
): Promise<InvitationResult> {
  const { data: invitation, error } = await supabase
    .from(DATABASE_TABLES.GROUP_INVITATIONS)
    .select('group_id, status')
    .eq('id', invitationId)
    .single();

  if (error || !invitation) {
    return { ok: false, code: 'not_found', message: 'Invitation not found' };
  }

  const adminRole = await checkGroupAdmin(supabase, invitation.group_id, userId);
  if (!adminRole) {
    return { ok: false, code: 'forbidden', message: 'Only admins can revoke invitations' };
  }
  if (invitation.status !== STATUS.GROUP_INVITATIONS.PENDING) {
    return { ok: false, code: 'invalid', message: 'Can only revoke pending invitations' };
  }

  const { error: updateError } = await supabase
    .from(DATABASE_TABLES.GROUP_INVITATIONS)
    .update({ status: STATUS.GROUP_INVITATIONS.REVOKED })
    .eq('id', invitationId);

  if (updateError) {
    return { ok: false, dbError: updateError };
  }
  return { ok: true, message: 'Invitation revoked' };
}

/**
 * List a group's invitations (admins only), newest first, paginated.
 * `opts` carries the raw URL query values; defaulting/clamping is applied here
 * so the route stays free of pagination logic.
 */
export async function listGroupInvitations(
  supabase: AnySupabaseClient,
  slug: string,
  userId: string,
  opts: { status?: string | null; limit?: string | null; offset?: string | null }
): Promise<
  InvitationCollectionResult<{ invitations: unknown[]; total: number; hasMore: boolean }>
> {
  const group = await resolveGroupBySlug(supabase, slug);
  if (!group) {
    return { ok: false, code: 'not_found', message: 'Group not found' };
  }
  if (!(await checkGroupAdmin(supabase, group.id, userId))) {
    return { ok: false, code: 'forbidden', message: 'Only admins can view invitations' };
  }

  const status = opts.status || STATUS.GROUP_INVITATIONS.PENDING;
  const limit = Math.min(
    parseInt(opts.limit || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );
  const offset = Math.max(parseInt(opts.offset || '0', 10) || 0, 0);

  let query = supabase
    .from(DATABASE_TABLES.GROUP_INVITATIONS)
    .select(
      `*, inviter:profiles!group_invitations_invited_by_fkey (name, avatar_url), invitee:profiles!group_invitations_user_id_fkey (name, avatar_url)`,
      { count: 'exact' }
    )
    .eq('group_id', group.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: invitations, count, error } = await query;
  if (error) {
    logger.error('Failed to fetch invitations', { error, groupId: group.id }, 'Groups');
    return { ok: false, dbError: error };
  }

  return {
    ok: true,
    data: {
      invitations: invitations || [],
      total: count || 0,
      hasMore: (invitations?.length || 0) === limit,
    },
  };
}

/**
 * Authorize invitation creation: resolve the group and confirm the actor is an
 * admin. Split from the create step so the route can keep its original ordering
 * (permission gate before body validation). Returns the group id on success.
 */
export async function authorizeGroupInvitationCreate(
  supabase: AnySupabaseClient,
  slug: string,
  userId: string
): Promise<InvitationCollectionResult<{ groupId: string }>> {
  const group = await resolveGroupBySlug(supabase, slug);
  if (!group) {
    return { ok: false, code: 'not_found', message: 'Group not found' };
  }
  return authorizeGroupInvitationCreateById(supabase, group.id, userId);
}

/** The same gate for a caller that holds the group's id (the Cat). */
export async function authorizeGroupInvitationCreateById(
  supabase: AnySupabaseClient,
  groupId: string,
  userId: string
): Promise<InvitationCollectionResult<{ groupId: string }>> {
  if (!(await checkGroupAdmin(supabase, groupId, userId))) {
    return { ok: false, code: 'forbidden', message: 'Only admins can create invitations' };
  }
  return { ok: true, data: { groupId } };
}

/**
 * Create an invitation for an already-authorized group. Guards against inviting
 * an existing member or duplicating a pending invite, computes expiry, and
 * tells the invitee — with a link to the page where they answer. Inserting the
 * row was all this did before; nobody ever learned they had been invited.
 */
export async function createGroupInvitation(
  supabase: AnySupabaseClient,
  groupId: string,
  invitedBy: string,
  input: CreateInvitationInput
): Promise<InvitationCollectionResult<{ invitation: Record<string, unknown> }>> {
  const { user_id, role, message, expires_in_days } = input;

  const [{ data: existingMember }, { data: existingInvite }] = await Promise.all([
    supabase
      .from(DATABASE_TABLES.GROUP_MEMBERS)
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user_id)
      .maybeSingle(),
    supabase
      .from(DATABASE_TABLES.GROUP_INVITATIONS)
      .select('id')
      .eq('group_id', groupId)
      .eq('user_id', user_id)
      .eq('status', STATUS.GROUP_INVITATIONS.PENDING)
      .maybeSingle(),
  ]);
  if (existingMember) {
    return { ok: false, code: 'invalid', message: 'They are already a member of this group' };
  }
  if (existingInvite) {
    return { ok: false, code: 'invalid', message: 'They already have a pending invitation' };
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_in_days);

  const { data: invitation, error: insertError } = await supabase
    .from(DATABASE_TABLES.GROUP_INVITATIONS)
    .insert({
      group_id: groupId,
      user_id,
      role,
      message: message || null,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError || !invitation) {
    logger.error('Failed to create invitation', { error: insertError, groupId }, 'Groups');
    return { ok: false, dbError: insertError };
  }

  await notifyInvitee(groupId, invitation.id as string, user_id, invitedBy);
  return { ok: true, data: { invitation } };
}

/** Best effort: the invitation stands even if the notice fails to send. */
async function notifyInvitee(
  groupId: string,
  invitationId: string,
  inviteeId: string,
  invitedBy: string
): Promise<void> {
  try {
    // Service role: the invitee's notifications, and a group that may be
    // private, are not the inviter's to read or write.
    const admin = getAdminClient() as unknown as AnySupabaseClient;
    const [{ data: group }, { data: inviter }] = await Promise.all([
      admin.from(DATABASE_TABLES.GROUPS).select('name').eq('id', groupId).maybeSingle(),
      admin
        .from(DATABASE_TABLES.PROFILES)
        .select('name, username')
        .eq('id', invitedBy)
        .maybeSingle(),
    ]);
    const groupName = (group as { name?: string } | null)?.name || 'a group';
    const who = inviter as { name?: string | null; username?: string | null } | null;
    const inviterName = who?.name || (who?.username ? `@${who.username}` : 'Someone');
    await new NotificationService(admin as never).createNotification({
      recipientUserId: inviteeId,
      type: 'group_invite',
      title: `${inviterName} invited you to join ${groupName}`,
      actionUrl: ROUTES.DASHBOARD.INVITATION(invitationId),
      sourceEntityType: 'group',
      sourceEntityId: groupId,
      metadata: { groupName, invitationId },
    });
  } catch (error) {
    logger.warn('Invitation notice not sent', { error, invitationId }, 'Groups');
  }
}
