import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { slugify } from '@/utils/string';
import { GROUP_LABELS, isGroupLabel } from '@/config/group-labels';
import type { ActionHandler } from './types';

export const organizationHandlers: Record<string, ActionHandler> = {
  invite_to_organization: async (supabase, userId, _actorId, params) => {
    // group_invitations: group_id (= organization_id), user_id, role, invited_by (inviter's userId)
    // Accepts either `username` (Cat-friendly) or `user_id` (UUID). Resolves username → user_id.
    let inviteeId = params.user_id as string | undefined;

    if (!inviteeId && params.username) {
      const rawUsername = (params.username as string).replace(/^@/, '');
      const { data: profile, error: profileError } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id')
        .eq('username', rawUsername)
        .maybeSingle();
      if (profileError || !profile) {
        return { success: false, error: `User @${rawUsername} not found on OrangeCat` };
      }
      inviteeId = profile.id as string;
    }

    if (!inviteeId) {
      return { success: false, error: 'Provide either username or user_id for the invitee' };
    }

    const { data, error } = await supabase
      .from(DATABASE_TABLES.GROUP_INVITATIONS)
      .insert({
        group_id: params.organization_id,
        user_id: inviteeId,
        role: (params.role as string) || 'member',
        invited_by: userId,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    const role = (params.role as string) || 'member';
    const recipientDisplay = params.username
      ? (params.username as string).startsWith('@')
        ? params.username
        : `@${params.username}`
      : `user ${inviteeId.slice(0, 8)}`;
    return {
      success: true,
      data: {
        ...data,
        displayMessage: `📨 Invitation sent to ${recipientDisplay} (role: ${role})`,
      },
    };
  },

  create_organization: async (supabase, userId, _actorId, params) => {
    // groups table has: name, slug (UNIQUE NOT NULL), label (not type), created_by
    // label enum: the ids in @bitbaum/collective-kinds (GROUP_LABEL_IDS)
    const name = params.name as string;
    const slug = slugify(name, { maxLength: 60, randomSuffix: true });
    // A word the model made up ("bar", "party crew") is not a kind — storing it
    // gave the group a label no screen knows. Unknown words fall back to circle.
    const asked = (params.label as string | null) ?? (params.type as string | null);
    const label = isGroupLabel(asked) ? asked : 'circle';

    // Create the group (organization)
    const { data: group, error: groupError } = await supabase
      .from(ENTITY_REGISTRY.group.tableName)
      .insert({
        name,
        slug,
        description: params.description || null,
        label,
        created_by: userId,
      })
      .select()
      .single();

    if (groupError) {
      return { success: false, error: groupError.message };
    }

    // The creator's founder membership and the group's `actors` row are written
    // by the `groups_get_an_identity_and_an_owner` trigger, atomically with the
    // group row above.
    //
    // This path used to insert the membership itself with `role: 'admin'`,
    // which no DELETE policy on `groups` accepts — both require 'founder'. It
    // had never fired in production (zero 'admin' memberships exist), but it
    // would have minted undeletable groups the moment it did.

    return {
      success: true,
      data: {
        ...group,
        displayMessage: `👥 ${GROUP_LABELS[label].name} "${name}" created`,
      },
    };
  },
};
