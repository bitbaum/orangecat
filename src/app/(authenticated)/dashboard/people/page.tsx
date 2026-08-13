'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import EntityListShell from '@/components/entity/EntityListShell';
import { Users, Search } from 'lucide-react';
import Link from 'next/link';
import InviteBanner from './components/InviteBanner';
import PeopleTabBar from './components/PeopleTabBar';
import PersonCard from './components/PersonCard';
import { usePeopleConnections } from './components/usePeopleConnections';
import { ROUTES } from '@/config/routes';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

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
    followingLoading,
    handleFollow,
    handleUnfollow,
    isFollowing,
  } = usePeopleConnections(user?.id, hydrated);

  // Redirect if not authenticated
  useEffect(() => {
    if (hydrated && !authLoading && (!user || !session)) {
      router.push(authLoginPath(ROUTES.DASHBOARD.PEOPLE));
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

  const discoverButton = (
    <Link href={ROUTES.DISCOVER_TYPE('profiles')}>
      <Button>
        <Search className="w-4 h-4 mr-2" />
        Discover People
      </Button>
    </Link>
  );
  const profileUsername = currentProfile?.username?.trim();

  return (
    <EntityListShell
      title="People"
      description="Connect with Bitcoin enthusiasts and easily access their profiles to send Bitcoin"
      headerActions={discoverButton}
    >
      {profileUsername ? (
        <InviteBanner
          showShare={showShare}
          onToggleShare={() => setShowShare(!showShare)}
          onCloseShare={() => setShowShare(false)}
          profileUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}${ROUTES.PROFILES.VIEW(profileUsername)}`}
          profileUsername={profileUsername}
          profileName={currentProfile?.name || profileUsername}
          profileBio={currentProfile?.bio || undefined}
        />
      ) : (
        <div className="mb-6 rounded-lg border border-default bg-surface-raised p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-fg-primary">Make your profile shareable</h2>
              <p className="text-sm text-fg-secondary">
                Choose a username before inviting people so your link always works.
              </p>
            </div>
            <Link href={ROUTES.DASHBOARD.INFO_EDIT}>
              <Button>Choose a username</Button>
            </Link>
          </div>
        </div>
      )}

      <PeopleTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        followingCount={following.length}
        followersCount={followers.length}
        allUsersCount={allUsers.length}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {connections.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No connections yet"
          description={emptyMessage}
          action={discoverButton}
        />
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
