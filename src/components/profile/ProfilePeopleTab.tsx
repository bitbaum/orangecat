'use client';
import { logger } from '@/utils/logger';
import { fetchFollowList } from '@/services/social/followList';
import { extractProfiles, type Connection, type FollowWithProfile } from './followProfiles';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ScalableProfile } from '@/services/profile/types';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import supabase from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { DATABASE_TABLES } from '@/config/database-tables';

interface ProfilePeopleTabProps {
  profile: ScalableProfile;
  isOwnProfile?: boolean;
}

/**
 * ProfilePeopleTab Component
 *
 * Displays user's connections (followers/following) in a tab context.
 * Shows people the user is connected with.
 */
export default function ProfilePeopleTab({ profile, isOwnProfile }: ProfilePeopleTabProps) {
  const { user } = useAuth();
  const [following, setFollowing] = useState<Connection[]>([]);
  const [followers, setFollowers] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeView, setActiveView] = useState<'following' | 'followers'>('followers');

  useEffect(() => {
    if (!profile.id) {
      return;
    }

    let cancelled = false;
    const fetchConnections = async () => {
      try {
        setLoading(true);
        setError(false);

        // Check if this is the user's own profile (use prop or check user)
        const isCurrentUserProfile = isOwnProfile || user?.id === profile.id;

        if (isCurrentUserProfile) {
          // For own profile, use direct Supabase queries (no API auth issues)

          // Fetch following
          const { data: followingData, error: followingError } = await supabase
            .from(DATABASE_TABLES.FOLLOWS)
            .select(
              `
              following_id,
              profiles!follows_following_id_fkey (
                id,
                username,
                name,
                bio,
                avatar_url
              )
            `
            )
            .eq('follower_id', profile.id);

          if (cancelled) {
            return;
          }
          if (!followingError && followingData) {
            const followingProfiles = extractProfiles(followingData as FollowWithProfile[]);
            setFollowing(followingProfiles);
          }

          // Fetch followers
          const { data: followersData, error: followersError } = await supabase
            .from(DATABASE_TABLES.FOLLOWS)
            .select(
              `
              follower_id,
              profiles!follows_follower_id_fkey (
                id,
                username,
                name,
                bio,
                avatar_url
              )
            `
            )
            .eq('following_id', profile.id);

          if (cancelled) {
            return;
          }
          if (!followersError && followersData) {
            const followerProfiles = extractProfiles(followersData as FollowWithProfile[]);
            setFollowers(followerProfiles);
          }
        } else {
          // For other profiles, use API (will work if public data).
          // fetchFollowList owns the envelope unwrap — see services/social/followList.ts.
          const [followingRows, followerRows] = await Promise.all([
            fetchFollowList('following', profile.id),
            fetchFollowList('followers', profile.id),
          ]);
          if (cancelled) {
            return;
          }
          setFollowing(extractProfiles(followingRows as FollowWithProfile[]));
          setFollowers(extractProfiles(followerRows as FollowWithProfile[]));
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('Failed to fetch connections:', error);
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchConnections();
    return () => {
      cancelled = true;
    };
  }, [profile.id, isOwnProfile, user?.id, reloadKey]);

  if (loading) {
    return <div className="text-fg-secondary text-sm py-8 text-center">Loading connections...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Users className="w-12 h-12 mx-auto mb-4 text-fg-tertiary" />
        <h3 className="text-lg font-semibold text-fg-primary mb-2">Couldn’t load connections</h3>
        <p className="text-fg-secondary mb-6">Something went wrong fetching followers.</p>
        <Button variant="outline" onClick={() => setReloadKey(k => k + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  const currentList = activeView === 'following' ? following : followers;
  const hasConnections = currentList.length > 0;

  return (
    <div className="space-y-6">
      {/* Toggle between Followers and Following */}
      <div className="flex gap-2 sm:gap-4 border-b border-default">
        <button
          onClick={() => setActiveView('followers')}
          className={`pb-2 sm:pb-3 px-2 sm:px-4 text-sm sm:text-base font-medium transition-colors ${
            activeView === 'followers'
              ? 'text-fg-primary border-b-2 border-fg-primary'
              : 'text-fg-secondary hover:text-fg-primary'
          }`}
        >
          Followers ({followers.length})
        </button>
        <button
          onClick={() => setActiveView('following')}
          className={`pb-2 sm:pb-3 px-2 sm:px-4 text-sm sm:text-base font-medium transition-colors ${
            activeView === 'following'
              ? 'text-fg-primary border-b-2 border-fg-primary'
              : 'text-fg-secondary hover:text-fg-primary'
          }`}
        >
          Following ({following.length})
        </button>
      </div>

      {/* Empty State */}
      {!hasConnections && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-fg-tertiary dark:text-fg-secondary mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg-primary mb-2">
            {activeView === 'following' ? 'No Following Yet' : 'No Followers Yet'}
          </h3>
          <p className="text-fg-secondary">
            {isOwnProfile
              ? activeView === 'following'
                ? 'Start following people to see them here'
                : 'When people follow you, they will appear here'
              : activeView === 'following'
                ? 'Not following anyone yet'
                : 'No followers yet'}
          </p>
        </div>
      )}

      {/* People List */}
      {hasConnections && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4">
          {currentList.map(person => {
            // Skip if no username or id
            if (!person.username || !person.id) {
              logger.warn('Person missing username or id:', person);
              return null;
            }

            return (
              <Link
                key={person.id}
                href={`/profiles/${person.username}`}
                className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border border-default hover:border-strong oc-card-link"
              >
                {person.avatar_url ? (
                  <Image
                    src={person.avatar_url}
                    alt={person.name || person.username}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12"
                  />
                ) : (
                  <DefaultAvatar size={40} className="rounded-lg flex-shrink-0 sm:!w-12 sm:!h-12" />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-fg-primary truncate text-sm sm:text-base">
                    {person.name || person.username}
                  </h4>
                  <p className="text-xs sm:text-sm text-fg-secondary mb-1">@{person.username}</p>
                  {person.bio && (
                    <p className="text-xs sm:text-sm text-fg-secondary line-clamp-1 sm:line-clamp-2">
                      {person.bio}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
