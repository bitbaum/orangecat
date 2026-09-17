/**
 * Governance Presets Configuration (SSOT)
 *
 * Defines permission templates for different governance models.
 * Groups select a preset but can override individual member permissions.
 *
 * Adding a new governance model = adding an entry here. No code changes needed.
 */

/**
 * Two states, because two is all the database can honour.
 *
 * There was a third, `vote_required`, on 15 cells. Nothing ever raised a vote:
 * `canPerformAction` returned allowed with a `requiresVote` flag that no caller
 * in the codebase read, and `checkGroupPermission` returned denied for the same
 * cell — so one door opened and the other did not. The only thing enforcing it
 * was the settings page hiding its delete button, which the API did not check.
 *
 * Collapsed to what RLS will actually accept: founders and admins keep every
 * ability they already effectively had, and members stop being told yes for a
 * write the database rejects. Real deliberation — proposals, quorum, a record
 * of why — is Solon's job, not a string in this file.
 */
export type ActionPermission = 'allow' | 'deny';

export interface RolePermissions {
  manage_settings: ActionPermission;
  manage_members: ActionPermission;
  invite_members: ActionPermission;
  remove_members: ActionPermission;
  spend_funds: ActionPermission;
  create_project: ActionPermission;
  create_proposal: ActionPermission;
  vote: ActionPermission;
  delete_group: ActionPermission;
}

interface GovernancePresetConfig {
  id: string;
  name: string;
  description: string;
  votingThreshold: number | null; // null = no voting, direct authority
  roles: {
    founder: RolePermissions;
    admin: RolePermissions;
    member: RolePermissions;
  };
}

export const GOVERNANCE_PRESETS = {
  consensus: {
    id: 'consensus',
    name: 'Consensus',
    description: 'All members are equal. Major decisions require agreement.',
    votingThreshold: 100, // Unanimous
    roles: {
      founder: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'allow',
      },
      admin: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
      member: {
        manage_settings: 'deny',
        manage_members: 'deny',
        invite_members: 'allow',
        remove_members: 'deny',
        spend_funds: 'deny',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
    },
  },

  democratic: {
    id: 'democratic',
    name: 'Democratic',
    description: 'Majority voting on important decisions.',
    votingThreshold: 51, // Simple majority
    roles: {
      founder: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'allow',
      },
      admin: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
      member: {
        manage_settings: 'deny',
        manage_members: 'deny',
        invite_members: 'deny',
        remove_members: 'deny',
        spend_funds: 'deny',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
    },
  },

  hierarchical: {
    id: 'hierarchical',
    name: 'Hierarchical',
    description: 'Founders and admins make decisions.',
    votingThreshold: null, // No voting, direct authority
    roles: {
      founder: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'allow',
      },
      admin: {
        manage_settings: 'allow',
        manage_members: 'allow',
        invite_members: 'allow',
        remove_members: 'allow',
        spend_funds: 'allow',
        create_project: 'allow',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
      member: {
        manage_settings: 'deny',
        manage_members: 'deny',
        invite_members: 'deny',
        remove_members: 'deny',
        spend_funds: 'deny',
        create_project: 'deny',
        create_proposal: 'allow',
        vote: 'allow',
        delete_group: 'deny',
      },
    },
  },
} as const satisfies Record<string, GovernancePresetConfig>;

export type GovernancePreset = keyof typeof GOVERNANCE_PRESETS;
export type GroupRole = 'founder' | 'admin' | 'member';
