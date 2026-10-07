/**
 * Groups Dashboard Component
 *
 * Unified dashboard for groups using EntityListShell for consistency.
 * Displays user's groups and available groups for discovery with tabs.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 * Last Modified Summary: Refactored to use EntityListShell, removed duplicate buttons, updated paths
 */

'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Users, Target, TrendingUp, Building2, Search } from 'lucide-react';
import groupsService from '@/services/groups';
import type { Group } from '@/types/group';
import { GROUP_LABELS, type GroupLabel } from '@/config/group-labels';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { GroupList } from './GroupList';
import { useRouter } from 'next/navigation';
import EntityListShell from '@/components/entity/EntityListShell';
import Loading from '@/components/Loading';
import { ROUTES } from '@/config/routes';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

export function GroupsDashboard() {
  const router = useRouter();
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load user's groups
      const groupsResult = await groupsService.getUserGroups();
      if (groupsResult.success) {
        setMyGroups(groupsResult.groups || []);
      }

      // Load available groups for discovery
      const availableResult = await groupsService.getAvailableGroups();
      if (availableResult.success) {
        setAvailableGroups(availableResult.groups || []);
      }
    } catch (error) {
      logger.error('Failed to load groups data:', error);
      toast.error('Failed to load groups data');
    } finally {
      setLoading(false);
    }
  };

  // Reload data when returning from create page
  useEffect(() => {
    const handleFocus = () => {
      loadDashboardData();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  if (loading) {
    return <Loading fullScreen message="Loading your groups..." />;
  }

  // Calculate stats by label type
  const _countByLabel = (_groups: Group[], _label: GroupLabel) =>
    _groups.filter(g => g.label === _label).length;

  // Informal groups (circles, families)
  const informalCount = myGroups.filter(g => ['circle', 'family'].includes(g.label)).length;

  // Formal groups (everything else)
  const formalCount = myGroups.length - informalCount;

  // Client-side search across name + description (lists are already loaded).
  const q = query.trim().toLowerCase();
  const matches = (g: Group) =>
    !q || g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
  const filteredMyGroups = myGroups.filter(matches);
  const filteredAvailable = availableGroups.filter(matches);
  const hasAnyGroups = myGroups.length + availableGroups.length > 0;

  const headerActions = (
    <Button href={ROUTES.DASHBOARD.GROUPS_CREATE} variant="accent" className="gap-2">
      <Plus className="h-4 w-4" />
      Create Group
    </Button>
  );

  return (
    <EntityListShell
      title="My Groups"
      description="Create groups, join communities, and collaborate with like-minded people"
      headerActions={headerActions}
    >
      {/* Search across both tabs (only when there's something to search) */}
      {hasAnyGroups && (
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-secondary" />
          <Input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search groups by name or description…"
            className="pl-9"
            aria-label="Search groups"
          />
        </div>
      )}

      {/* Tabs for My Groups and Discover */}
      <Tabs defaultValue="my-groups" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my-groups" className="gap-2 text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="truncate">My Groups ({filteredMyGroups.length})</span>
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2 text-xs sm:text-sm">
            <Building2 className="h-4 w-4" />
            <span className="truncate">Discover ({filteredAvailable.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="my-groups" className="space-y-4">
          {myGroups.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-base rounded-lg border dark:border-default">
              <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
              <p className="text-fg-secondary mb-6">Create your first group to get started</p>
              <Button href={ROUTES.DASHBOARD.GROUPS_CREATE} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </div>
          ) : filteredMyGroups.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-base rounded-lg border dark:border-default">
              <p className="text-fg-secondary">No groups match “{query}”.</p>
            </div>
          ) : (
            <GroupList
              groups={filteredMyGroups}
              onGroupClick={group =>
                router.push(`${ENTITY_REGISTRY['group'].basePath}/${group.slug}`)
              }
            />
          )}
        </TabsContent>

        <TabsContent value="discover" className="space-y-4">
          {availableGroups.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-base rounded-lg border dark:border-default">
              <h3 className="text-lg font-semibold mb-2">No groups available</h3>
              <p className="text-fg-secondary mb-6">Be the first to create a group!</p>
              <Button href={ROUTES.DASHBOARD.GROUPS_CREATE} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Group
              </Button>
            </div>
          ) : filteredAvailable.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-base rounded-lg border dark:border-default">
              <p className="text-fg-secondary">No groups match “{query}”.</p>
            </div>
          ) : (
            <GroupList
              groups={filteredAvailable}
              onGroupClick={group =>
                router.push(`${ENTITY_REGISTRY['group'].basePath}/${group.slug}`)
              }
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Stats Cards - Show Last (Optional Info) - Hidden on Mobile */}
      <div className="hidden md:grid md:grid-cols-3 gap-4 pt-6 border-t mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{myGroups.length}</div>
            <p className="text-xs text-fg-secondary">
              {informalCount} informal, {formalCount} formal
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Types</CardTitle>
            <Target className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                Object.keys(GROUP_LABELS).filter(label => myGroups.some(g => g.label === label))
                  .length
              }
            </div>
            <p className="text-xs text-fg-secondary">Different labels used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <TrendingUp className="h-4 w-4 text-fg-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{availableGroups.length}</div>
            <p className="text-xs text-fg-secondary">Groups to discover</p>
          </CardContent>
        </Card>
      </div>
    </EntityListShell>
  );
}
