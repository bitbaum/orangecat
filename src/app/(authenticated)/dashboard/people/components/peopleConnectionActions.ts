import { toast } from 'sonner';
import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export async function followUser(
  profileId: string,
  userId: string,
  setFollowingLoading: (id: string | null) => void,
  loadConnections: () => void
): Promise<void> {
  setFollowingLoading(profileId);
  try {
    const response = await fetch(API_ROUTES.SOCIAL.FOLLOW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: profileId }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      toast.success('Connected!');
      loadConnections();
    } else {
      throw new Error(apiErrorMessage(data, 'Failed to connect'));
    }
  } catch (error) {
    logger.error('Failed to follow user', { error, profileId }, 'PeoplePage');
    toast.error(error instanceof Error ? error.message : 'Failed to connect');
  } finally {
    setFollowingLoading(null);
  }
}

export async function unfollowUser(
  profileId: string,
  userId: string,
  setFollowingLoading: (id: string | null) => void,
  loadConnections: () => void
): Promise<void> {
  setFollowingLoading(profileId);
  try {
    const response = await fetch(API_ROUTES.SOCIAL.UNFOLLOW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: profileId }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      toast.success('Disconnected');
      loadConnections();
    } else {
      throw new Error(apiErrorMessage(data, 'Failed to disconnect'));
    }
  } catch (error) {
    logger.error('Failed to unfollow user', { error, profileId }, 'PeoplePage');
    toast.error(error instanceof Error ? error.message : 'Failed to disconnect');
  } finally {
    setFollowingLoading(null);
  }
}
