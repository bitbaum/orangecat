import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { DATABASE_TABLES } from '@/config/database-tables';
import { slugify } from '@/utils/string';
import { PROPOSAL_TYPES } from '@/config/proposal-constants';
import { ROUTES } from '@/config/routes';
import { SOLON_PROPOSAL_CATEGORY } from '@/config/solon';
import { solonProposalHandoff } from '@/config/neighbour-capabilities';
import { createProposal } from '@/services/groups/mutations/proposals';
import type { ActionHandler } from './types';

const PROPOSAL_TYPE_VALUES: readonly string[] = Object.values(PROPOSAL_TYPES);

/**
 * Shared money is decided by the people who share it. This files the
 * question; it never spends, opens the vote, or casts one.
 */
const proposeToGroup: ActionHandler = async (supabase, _userId, _actorId, params) => {
  const groupId = typeof params.group_id === 'string' ? params.group_id : '';
  const title = typeof params.title === 'string' ? params.title.trim() : '';
  const description = typeof params.description === 'string' ? params.description.trim() : '';
  if (!groupId || !title || !description) {
    return { success: false, error: 'group_id, title and description are required' };
  }
  const proposalType = PROPOSAL_TYPE_VALUES.includes(params.proposal_type as string)
    ? (params.proposal_type as string)
    : PROPOSAL_TYPES.TREASURY;

  const { data: group } = await supabase
    .from(ENTITY_REGISTRY.group.tableName)
    .select('id, name, slug')
    .eq('id', groupId)
    .maybeSingle();
  if (!group) {
    return { success: false, error: 'No such group, or you are not in it' };
  }
  const groupPath = ROUTES.GROUPS.VIEW(group.slug as string);

  if (params.decide_on === 'solon') {
    const link = solonProposalHandoff({
      title,
      body: `${description}\n\nGroup: ${group.name}`,
      category:
        proposalType === PROPOSAL_TYPES.TREASURY
          ? SOLON_PROPOSAL_CATEGORY.TREASURY_SPEND
          : SOLON_PROPOSAL_CATEGORY.OPERATIONS,
      source: groupPath,
    });
    return {
      success: true,
      data: {
        solonProposalUrl: link,
        displayMessage: `🏛️ Solon proposal prepared for ${group.name} — a member files and signs it there`,
        message: `Nothing is filed yet. The proposal is written and waiting at ${link}; a member of ${group.name} opens it, files it and signs it, and the members vote.`,
      },
    };
  }

  const result = await createProposal(
    { group_id: group.id as string, title, description, proposal_type: proposalType },
    supabase
  );
  if (!result.success || !result.proposal) {
    return { success: false, error: result.error ?? 'Could not file the proposal' };
  }
  const proposalPath = `${groupPath}/proposals/${result.proposal.id}`;
  return {
    success: true,
    data: {
      proposalId: result.proposal.id,
      proposalPath,
      displayMessage: `🗳️ Proposal "${title}" filed as a draft in ${group.name}`,
      message: `Filed as a draft in ${group.name}. Nothing is spent: open the vote from ${proposalPath} and the members decide.`,
    },
  };
};

export const organizationHandlers: Record<string, ActionHandler> = {
  propose_to_group: proposeToGroup,

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

    // Create the group (organization)
    const { data: group, error: groupError } = await supabase
      .from(ENTITY_REGISTRY.group.tableName)
      .insert({
        name,
        slug,
        description: params.description || null,
        label: (params.label as string | null) ?? (params.type as string | null) ?? 'circle',
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

    const groupLabel =
      (params.label as string | null) ?? (params.type as string | null) ?? 'circle';
    return {
      success: true,
      data: {
        ...group,
        displayMessage: `👥 ${groupLabel.charAt(0).toUpperCase() + groupLabel.slice(1)} "${name}" created`,
      },
    };
  },
};
