'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import groupsService from '@/services/groups';
import { isGroupMember } from '@/services/groups/utils/helpers';
import { canSeeGroupContent } from '@/services/groups/utils/visibility';
import type { Group, GroupMember } from '@/types/group';
import { GROUP_LABELS, type GroupLabel } from '@/config/group-labels';
import { GOVERNANCE_PRESETS, type GovernancePreset } from '@/config/governance-presets';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

export function useGroupDetail(groupSlug: string) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [wallets, setWallets] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [canCreateProposal, setCanCreateProposal] = useState(false);
  const [canSeeContent, setCanSeeContent] = useState(false);

  const loadGroupData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const groupResult = await groupsService.getGroup(groupSlug, true);
      if (!groupResult.success || !groupResult.group) {
        setError('Group not found');
        return;
      }

      setGroup(groupResult.group);

      // A members-only or private group shows an outsider its name and label
      // and nothing else, so nothing else is asked for.
      const isMember = user
        ? user.id === groupResult.group.created_by ||
          (await isGroupMember(groupResult.group.id, user.id))
        : false;
      const contentVisible = canSeeGroupContent(groupResult.group, isMember);
      setCanSeeContent(contentVisible);
      if (!contentVisible) {
        setMembers([]);
        setWallets([]);
        setCanCreateProposal(false);
        return;
      }

      const membersResult = await groupsService.getGroupMembers(groupResult.group.id);
      if (membersResult.success) {
        setMembers((membersResult.members || []) as unknown as GroupMember[]);
      }

      const walletsResult = await groupsService.getGroupWallets(groupResult.group.id);
      if (walletsResult.success) {
        setWallets(walletsResult.wallets || []);
      }

      if (user) {
        try {
          const { checkGroupPermission } = await import('@/services/groups/permissions');
          const canCreate = await checkGroupPermission(
            groupResult.group.id,
            user.id,
            'canCreateProposals'
          );
          const canVotePerm = await checkGroupPermission(groupResult.group.id, user.id, 'canVote');
          setCanCreateProposal(canCreate);
          void canVotePerm;
        } catch (err) {
          logger.error('Failed to check permissions:', err);
        }
      }
    } catch (err) {
      logger.error('Failed to load group data:', err);
      setError('Failed to load group data');
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [groupSlug, user]);

  useEffect(() => {
    loadGroupData();
  }, [groupSlug, loadGroupData]);

  const labelConfig = group ? GROUP_LABELS[group.label as GroupLabel] : null;
  const governanceConfig = group
    ? GOVERNANCE_PRESETS[group.governance_preset as GovernancePreset]
    : null;
  const LabelIcon = labelConfig?.icon || Users;
  const isOwner = user?.id === group?.created_by;
  const hasGovernanceFeatures = governanceConfig?.votingThreshold !== null;

  return {
    user,
    group,
    members,
    wallets,
    loading,
    error,
    activeTab,
    setActiveTab,
    canCreateProposal,
    canSeeContent,
    loadGroupData,
    labelConfig,
    governanceConfig,
    LabelIcon,
    isOwner,
    hasGovernanceFeatures,
  };
}
