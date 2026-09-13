'use client';

import { useRouter } from 'next/navigation';
import EntityDetailLayout from '@/components/entity/EntityDetailLayout';
import { Button } from '@/components/ui/Button';
import { Settings } from 'lucide-react';
import Link from 'next/link';
import { useGroupDetail } from './useGroupDetail';
import { GroupDetailSidebar } from './GroupDetailSidebar';
import { GroupDetailTabs } from './GroupDetailTabs';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import LokiBuildCta from '@/components/integrations/LokiBuildCta';
import EntityShare from '@/components/sharing/EntityShare';
import { PublicSupportPanel } from '@/components/payment/PublicSupportPanel';

interface GroupDetailProps {
  groupSlug: string;
}

export function GroupDetail({ groupSlug }: GroupDetailProps) {
  const router = useRouter();
  const {
    user,
    group,
    members,
    wallets,
    loading,
    error,
    activeTab,
    setActiveTab,
    canCreateProposal,
    loadGroupData,
    labelConfig,
    governanceConfig,
    LabelIcon,
    isOwner,
    hasGovernanceFeatures,
  } = useGroupDetail(groupSlug);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-64 bg-surface-raised animate-pulse rounded-lg" />
        <div className="h-32 bg-surface-raised animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="text-center py-12">
        <p className="text-status-negative">{error || 'Group not found'}</p>
        <Button onClick={() => router.push(ROUTES.GROUPS.LIST)} className="mt-4">
          Back to Groups
        </Button>
      </div>
    );
  }

  // SSOT edit convention: createPath?edit=<id> (the old
  // /groups/[slug]/settings route never existed — dead link).
  const headerActions = isOwner ? (
    <Link href={`${ENTITY_REGISTRY['group'].createPath}?edit=${group.id}`}>
      <Button variant="outline">
        <Settings className="h-4 w-4 mr-2" />
        Edit Group
      </Button>
    </Link>
  ) : null;

  return (
    <EntityDetailLayout
      title={group.name}
      subtitle={group.description || undefined}
      headerActions={headerActions}
      left={
        <GroupDetailTabs
          group={group}
          members={members}
          wallets={wallets}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasGovernanceFeatures={hasGovernanceFeatures}
          isOwner={isOwner}
          user={user}
          canCreateProposal={canCreateProposal}
          onUpdate={loadGroupData}
          labelConfig={labelConfig}
        />
      }
      right={
        <div className="space-y-6">
          <GroupDetailSidebar
            group={group}
            members={members}
            wallets={wallets}
            labelConfig={labelConfig}
            governanceConfig={governanceConfig}
            LabelIcon={LabelIcon}
          />
          <EntityShare
            entityType="group"
            entityId={group.id}
            title={group.name}
            description={group.description ?? undefined}
            publicPath={`/groups/${groupSlug}`}
            className="w-full justify-center"
          />
          <PublicSupportPanel entityType="group" entityId={group.id} entityTitle={group.name} />
          {isOwner && (
            <LokiBuildCta
              variant="card"
              entityType="group"
              entityId={group.id}
              sourcePath={`/groups/${groupSlug}`}
            />
          )}
        </div>
      }
    />
  );
}
