'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { API_ROUTES } from '@/config/api-routes';
import { useAuth } from '@/hooks/useAuth';
import { fetchFollowStatus } from '@/services/social/followList';
import type { ScalableProfile } from '@/services/profile/types';
import type { ProfileFormData } from '@/types/database';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface UseProfileActionsParams {
  profile: ScalableProfile;
  isOwnProfile: boolean;
  onSave?: (data: ProfileFormData) => Promise<void>;
}

export function useProfileActions({ profile, isOwnProfile, onSave }: UseProfileActionsParams) {
  const { user } = useAuth();
  const router = useRouter();
  const [showShare, setShowShare] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const shareButtonRef = useRef<HTMLDivElement>(null);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user?.id || isOwnProfile || !profile.id) {
      return;
    }
    let cancelled = false;
    const checkFollowStatus = async () => {
      const following = await fetchFollowStatus(profile.id);
      if (!cancelled) {
        setIsFollowing(following);
      }
    };
    checkFollowStatus();
    return () => {
      cancelled = true;
    };
  }, [user?.id, profile.id, isOwnProfile]);

  useEffect(() => {
    if (!showShare) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (
        shareDropdownRef.current &&
        !shareDropdownRef.current.contains(event.target as Node) &&
        shareButtonRef.current &&
        !shareButtonRef.current.contains(event.target as Node)
      ) {
        setShowShare(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showShare]);

  const handleFollowToggle = async () => {
    if (!user?.id || !profile.id || isFollowLoading) {
      return;
    }
    setIsFollowLoading(true);
    try {
      const endpoint = isFollowing ? API_ROUTES.SOCIAL.UNFOLLOW : API_ROUTES.SOCIAL.FOLLOW;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ following_id: profile.id }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setIsFollowing(!isFollowing);
        toast.success(isFollowing ? 'Unfollowed' : 'Followed');
      } else if (response.status === 409) {
        // The server says the edge already exists — the button was showing a
        // stale state (another tab, or a request that landed after we read the
        // list). The user's intent is already satisfied, so reconcile rather
        // than reporting a failure for something that is in fact true.
        setIsFollowing(true);
        toast.info('You already follow this person');
      } else {
        throw new Error(apiErrorMessage(data, 'Failed to update follow status'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleProfileSave = async (data: ProfileFormData) => {
    try {
      const response = await fetch(API_ROUTES.PROFILE, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(apiErrorMessage(errorData, 'Failed to save profile'));
      }
      toast.success('Profile updated successfully');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save profile');
      throw error;
    }
  };

  return {
    showShare,
    setShowShare,
    isFollowing,
    isFollowLoading,
    shareButtonRef,
    shareDropdownRef,
    handleFollowToggle,
    resolvedHandleProfileSave: onSave ?? handleProfileSave,
  };
}
