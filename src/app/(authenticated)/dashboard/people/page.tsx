'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import EntityListShell from '@/components/entity/EntityListShell';
import { Users, Search } from 'lucide-react';
import InviteBanner from './components/InviteBanner';
import PeopleTabBar from './components/PeopleTabBar';
import PersonCard from './components/PersonCard';
import { usePeopleConnections } from './components/usePeopleConnections';
import { ROUTES } from '@/config/routes';

export default function PeoplePage() {
  const { user, profile: currentProfile, isLoading: authLoading, hydrated, session } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'following' | 'followers' | 'all'>('all');
  const [showShare, setShowShare] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const {
    following,
    followers,
    allUsers,
    isLoading,
    loadError,
    reload,
    followingLoading,
    handleFollow,
    handleUnfollow,
    isFollowing,
  } = usePeopleConnections(user?.id, hydrated);

  // Redirect if not authenticated
  useEffect(() => {
    if (hydrated && !authLoading && (!user || !session)) {
      router.push(`${ROUTES.AUTH}?from=${ROUTES.DASHBOARD.PEOPLE}`);
    }
  }, [user, session, hydrated, authLoading, router]);

  if (!hydrated || authLoading || isLoading) {
    return <Loading fullScreen />;
  }

  if (!user || !session) {
    return null;
  }

  const connections = (
    activeTab === 'following' ? following : activeTab === 'followers' ? followers : allUsers
  )
    .filter(conn => (activeTab === 'all' ? conn.profile.id !== user.id : true))
    .filter(conn => {
      if (!searchTerm.trim()) {
        return true;
      }
      const q = searchTerm.trim().toLowerCase();
      const p = conn.profile;
      return (
        (p.username || '').toLowerCase().includes(q) ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.bio || '').toLowerCase().includes(q)
      );
    });

  const emptyMessage =
    activeTab === 'following'
      ? "You haven't connected with anyone yet. Start building your Bitcoin network!"
      : activeTab === 'followers'
        ? 'No one has connected with you yet. Share your profile to get started!'
        : 'No users found yet.';

  // The page's one primary action, in the header only: it used to appear in
  // the header, the invite card and the empty state at once.
  const discoverButton = (
    <Button href={ROUTES.DISCOVER_TYPE('people')} variant="primary">
      <Search className="w-4 h-4 mr-2" />
      Discover people
    </Button>
  );

  return (
    <EntityListShell
      title="People"
      description="Connect with Bitcoin enthusiasts and easily access their profiles to send Bitcoin"
      headerActions={discoverButton}
    >
      <InviteBanner
        showShare={showShare}
        onToggleShare={() => setShowShare(!showShare)}
        onCloseShare={() => setShowShare(false)}
        profileUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/profiles/${currentProfile?.username || user.id}`}
        profileUsername={currentProfile?.username || user.id}
        profileName={currentProfile?.name || currentProfile?.username || 'My Profile'}
        profileBio={currentProfile?.bio || undefined}
      />

      <PeopleTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        followingCount={following.length}
        followersCount={followers.length}
        allUsersCount={allUsers.length}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {loadError ? (
        <div className="space-y-3 rounded-lg border border-default bg-surface-base p-4">
          <p role="status" className="mb-0 text-sm text-fg-secondary">
            People could not be loaded.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            Try again
          </Button>
        </div>
      ) : connections.length === 0 ? (
        <EmptyState icon={Users} title="No connections yet" description={emptyMessage} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map(connection => (
            <PersonCard
              key={connection.profile.id}
              profile={connection.profile}
              activeTab={activeTab}
              isFollowing={isFollowing(connection.profile.id)}
              isActionLoading={followingLoading === connection.profile.id}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
            />
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
