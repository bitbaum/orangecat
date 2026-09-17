import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import type { Profile } from '@/types/profile';
import { followUser, unfollowUser } from './peopleConnectionActions';
import { fetchFollowList, type FollowListProfile } from '@/services/social/followList';

export interface Connection {
  profile: Profile;
  created_at: string;
}

interface ConnectionResponseItem {
  following_id?: string;
  follower_id?: string;
  created_at: string;
  updated_at?: string;
  /** /api/social/* aliases the join to `profile`; a direct supabase query gives `profiles`. */
  profile?: FollowListProfile | null;
  profiles?: Profile;
  id?: string;
  username?: string;
  name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  bitcoin_address?: string;
  lightning_address?: string;
}

function transformConnectionItem(
  item: ConnectionResponseItem,
  idField: 'following_id' | 'follower_id',
  logContext: string
): Connection | null {
  // Accept either join key. The API aliases the joined row to `profile`
  // (singular) while a direct supabase select yields `profiles`; reading only
  // the plural made every API row resolve to null, so this page rendered an
  // empty Following/Followers list for everyone. Same trap as
  // components/profile/followProfiles.ts — one key, two spellings.
  const profileData =
    item.profile || item.profiles || (item[idField] ? null : (item as unknown as Profile));
  if (!profileData) {
    logger.warn(`Missing profile data in ${logContext} response`, { item }, 'PeoplePage');
    return null;
  }
  return {
    profile: {
      id: (profileData as Profile).id || item[idField] || '',
      username: (profileData as Profile).username,
      name: (profileData as Profile).name || null,
      avatar_url: (profileData as Profile).avatar_url,
      bio: (profileData as Profile).bio,
      bitcoin_address: (profileData as Profile).bitcoin_address,
      lightning_address: (profileData as Profile).lightning_address,
      created_at: (profileData as Profile).created_at || item.created_at,
      updated_at: (profileData as Profile).updated_at || item.created_at,
    },
    created_at: item.created_at,
  };
}

export function usePeopleConnections(userId: string | undefined, hydrated: boolean) {
  const [following, setFollowing] = useState<Connection[]>([]);
  const [followers, setFollowers] = useState<Connection[]>([]);
  const [allUsers, setAllUsers] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followingLoading, setFollowingLoading] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    if (!userId) {
      return;
    }

    setIsLoading(true);
    try {
      // fetchFollowList owns the envelope unwrap — see services/social/followList.ts.
      const [followingRows, followerRows, allRes] = await Promise.all([
        fetchFollowList('following', userId),
        fetchFollowList('followers', userId),
        fetch(`${API_ROUTES.PROFILES.BASE}?limit=100`, { credentials: 'same-origin' }),
      ]);

      setFollowing(
        followingRows
          .map(item => transformConnectionItem(item, 'following_id', 'following'))
          .filter(Boolean) as Connection[]
      );
      setFollowers(
        followerRows
          .map(item => transformConnectionItem(item, 'follower_id', 'followers'))
          .filter(Boolean) as Connection[]
      );

      if (allRes.ok) {
        const allData = await allRes.json();
        if (allData.success) {
          const raw = allData.data;
          const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
          const transformed: Connection[] = arr.map((p: ConnectionResponseItem) => ({
            profile: {
              id: p.id,
              username: p.username,
              name: p.name,
              avatar_url: p.avatar_url,
              bio: p.bio,
              bitcoin_address: p.bitcoin_address,
              lightning_address: p.lightning_address,
              created_at: p.created_at || '',
              updated_at: p.updated_at || p.created_at || '',
            },
            created_at: p.created_at,
          }));
          setAllUsers(transformed);
        }
      }
    } catch (error) {
      logger.error('Failed to load connections', { error }, 'PeoplePage');
      toast.error('Failed to load connections');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && hydrated) {
      loadConnections();
    }
  }, [userId, hydrated, loadConnections]);

  const handleFollow = async (profileId: string) => {
    if (!userId) {
      return;
    }
    await followUser(profileId, userId, setFollowingLoading, loadConnections);
  };

  const handleUnfollow = async (profileId: string) => {
    if (!userId) {
      return;
    }
    await unfollowUser(profileId, userId, setFollowingLoading, loadConnections);
  };

  const isFollowing = (profileId: string) => {
    return following.some(conn => conn.profile.id === profileId);
  };

  return {
    following,
    followers,
    allUsers,
    isLoading,
    followingLoading,
    handleFollow,
    handleUnfollow,
    isFollowing,
  };
}
