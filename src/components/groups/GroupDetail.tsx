'use client';

import { useRouter } from 'next/navigation';
import EntityDetailLayout from '@/components/entity/EntityDetailLayout';
import { Button } from '@/components/ui/Button';
import { Settings, Wallet } from 'lucide-react';
import { useGroupDetail } from './useGroupDetail';
import { GroupDetailSidebar } from './GroupDetailSidebar';
import { GroupDetailTabs } from './GroupDetailTabs';
import { GroupMembersOnly } from './GroupMembersOnly';
import { GroupJoinButton } from './GroupJoinButton';
import { groupIsOpenToJoin } from '@/services/groups/utils/joining';
import { PUBLIC_BREADCRUMB_ROOT } from '@/components/ui/Breadcrumb';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';
import LokiBuildCta from '@/components/integrations/LokiBuildCta';
import EntityShare from '@/components/sharing/EntityShare';
import { PublicSupportPanel } from '@/components/payment/PublicSupportPanel';
import { NoWalletYetNotice } from '@/components/payment/NoWalletYetNotice';
import { STATUS } from '@/config/database-constants';

/** The tab strip's anchor, so "Go to Wallets" can bring it into view on a phone. */
const GROUP_TABS_ID = 'group-tabs';

interface GroupDetailProps {
  groupSlug: string;
  /**
   * Whether a payment to this group can reach a wallet, resolved on the server
   * by the payment's own resolution (resolveSellerReceiveInfo). Without one the
   * page offers no pay form: the form could only fail after the amount.
   */
  canReceive: boolean;
}

export function GroupDetail({ groupSlug, canReceive }: GroupDetailProps) {
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
    canSeeContent,
    viewerRole,
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

  if (!canSeeContent) {
    return (
      <GroupMembersOnly
        name={group.name}
        slug={groupSlug}
        labelName={labelConfig?.name || group.label}
        LabelIcon={LabelIcon}
        signedIn={!!user}
      />
    );
  }

  // SSOT edit convention: createPath?edit=<id> (the old
  // /groups/[slug]/settings route never existed — dead link).
  // A visitor lands on the Overview tab, so Join sits in the header, not only
  // inside the Members tab where nobody arriving from a link would look.
  const headerActions = isOwner ? (
    <Button href={`${ENTITY_REGISTRY['group'].createPath}?edit=${group.id}`} variant="outline">
      <Settings className="h-4 w-4 mr-2" />
      Edit Group
    </Button>
  ) : (
    <GroupJoinButton
      groupId={group.id}
      groupSlug={groupSlug}
      openToJoin={groupIsOpenToJoin(group)}
      isMember={!!viewerRole}
      onJoined={() => void loadGroupData()}
    />
  );

  // A group's wallets are readable by its members only (RLS group_wallets_select),
  // so anyone else gets an empty list whatever the group holds. Printing that as
  // "0 Wallets" beside a pay card contradicted the card; say nothing instead.
  // Adding one is for founders and admins, the roles the create route accepts.
  const visibleWallets = viewerRole ? wallets : null;
  const canManageWallets =
    viewerRole === STATUS.GROUP_MEMBERS.FOUNDER || viewerRole === STATUS.GROUP_MEMBERS.ADMIN;
  // canReceive comes from the server: after a wallet is added, ask it again.
  const reload = () => {
    void loadGroupData();
    router.refresh();
  };
  const goToWallets = () => {
    setActiveTab('wallets');
    document.getElementById(GROUP_TABS_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <EntityDetailLayout
      breadcrumbRoot={PUBLIC_BREADCRUMB_ROOT}
      breadcrumbItems={[
        { label: ENTITY_REGISTRY.group.namePlural, href: ROUTES.DISCOVER_TYPE('groups') },
      ]}
      title={group.name}
      subtitle={group.description || undefined}
      headerActions={headerActions}
      left={
        <GroupDetailTabs
          id={GROUP_TABS_ID}
          group={group}
          members={members}
          wallets={visibleWallets}
          canManageWallets={canManageWallets}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasGovernanceFeatures={hasGovernanceFeatures}
          isOwner={isOwner}
          user={user}
          canCreateProposal={canCreateProposal}
          onUpdate={reload}
          labelConfig={labelConfig}
        />
      }
      right={
        <div className="space-y-6">
          <GroupDetailSidebar
            group={group}
            members={members}
            wallets={visibleWallets}
            labelConfig={labelConfig}
            governanceConfig={governanceConfig}
            LabelIcon={LabelIcon}
            isOwner={isOwner}
          />
          <EntityShare
            entityType="group"
            entityId={group.id}
            title={group.name}
            description={group.description ?? undefined}
            publicPath={`/groups/${groupSlug}`}
            className="w-full justify-center"
          />
          {canReceive ? (
            <PublicSupportPanel
              entityType="group"
              entityId={group.id}
              entityTitle={group.name}
              recipientName={group.name}
            />
          ) : (
            <NoWalletYetNotice payee="This group">
              {canManageWallets && (
                <Button variant="outline" className="w-full" onClick={goToWallets}>
                  <Wallet className="h-4 w-4 mr-2" />
                  Go to Wallets
                </Button>
              )}
            </NoWalletYetNotice>
          )}
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
