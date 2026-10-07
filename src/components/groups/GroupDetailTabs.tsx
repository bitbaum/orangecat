'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from 'lucide-react';
import type { Group, GroupMember } from '@/types/group';
import type { User } from '@supabase/supabase-js';
import type { GroupLabel } from '@/config/group-labels';
import { GROUP_LABELS } from '@/config/group-labels';
import { GroupMembers } from './GroupMembers';
import { GroupWallets } from './GroupWallets';
import { ProposalsList } from './proposals/ProposalsList';
import { EventsList } from './events/EventsList';
import { GroupActivityFeed } from './GroupActivityFeed';

interface GroupDetailTabsProps {
  group: Group;
  members: GroupMember[];
  wallets: unknown[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasGovernanceFeatures: boolean;
  isOwner: boolean;
  user: User | null;
  canCreateProposal: boolean;
  onUpdate: () => void;
  labelConfig: (typeof GROUP_LABELS)[GroupLabel] | null;
}

export function GroupDetailTabs({
  group,
  members,
  wallets,
  activeTab,
  onTabChange,
  hasGovernanceFeatures,
  isOwner,
  user,
  canCreateProposal,
  onUpdate,
  labelConfig,
}: GroupDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-6">
      {/* Six tabs do not fit a 320px phone: scroll the strip, never the page. */}
      <TabsList className="max-w-full justify-start overflow-x-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
        <TabsTrigger value="wallets">Wallets ({wallets.length})</TabsTrigger>
        <TabsTrigger value="events">
          <Calendar className="h-4 w-4 mr-1" />
          Events
        </TabsTrigger>
        {hasGovernanceFeatures && <TabsTrigger value="proposals">Proposals</TabsTrigger>}
        <TabsTrigger value="activity">Activity</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-fg-primary dark:text-fg-tertiary whitespace-pre-wrap">
              {group.description || 'No description provided.'}
            </p>
          </CardContent>
        </Card>

        {labelConfig?.suggestedFeatures && labelConfig.suggestedFeatures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suggested Features</CardTitle>
              <CardDescription>
                Features commonly used by {labelConfig.name.toLowerCase()} groups
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {labelConfig.suggestedFeatures.map(feature => (
                  <Badge key={feature} variant="outline">
                    {feature.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="members">
        <GroupMembers
          groupId={group.id}
          groupSlug={group.slug}
          members={members}
          onUpdate={onUpdate}
        />
      </TabsContent>

      <TabsContent value="wallets">
        <GroupWallets
          groupId={group.id}
          groupSlug={group.slug}
          wallets={wallets}
          onUpdate={onUpdate}
        />
      </TabsContent>

      <TabsContent value="events">
        <EventsList
          groupId={group.id}
          groupSlug={group.slug}
          canCreateEvent={
            isOwner ||
            members.some(m => m.user_id === user?.id && ['founder', 'admin'].includes(m.role))
          }
        />
      </TabsContent>

      {hasGovernanceFeatures && (
        <TabsContent value="proposals">
          <ProposalsList
            groupId={group.id}
            groupSlug={group.slug}
            canCreateProposal={canCreateProposal}
          />
        </TabsContent>
      )}

      <TabsContent value="activity">
        <GroupActivityFeed groupSlug={group.slug} />
      </TabsContent>
    </Tabs>
  );
}
