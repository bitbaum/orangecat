'use client';

/**
 * The one way into a group, wherever it is offered: the page header (where a
 * visitor lands) and the Members tab. Shown only where it can succeed — an
 * open group, a viewer who is not a member yet. Signed out, it is "Sign in to
 * join", back to this group; signed in, it joins.
 */

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import groupsService from '@/services/groups';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/utils/logger';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface GroupJoinButtonProps {
  groupId: string;
  groupSlug: string;
  /** Anyone may join without an invitation (services/groups/utils/joining.ts). */
  openToJoin: boolean;
  isMember: boolean;
  onJoined?: () => void;
  className?: string;
}

export function GroupJoinButton({
  groupId,
  groupSlug,
  openToJoin,
  isMember,
  onJoined,
  className,
}: GroupJoinButtonProps) {
  const { user, hydrated } = useAuth();
  const [joining, setJoining] = useState(false);

  if (isMember || !openToJoin || !hydrated) {
    return null;
  }

  if (!user) {
    return (
      <Button
        variant="primary"
        href={`${ROUTES.AUTH_LOGIN}&from=${encodeURIComponent(ROUTES.GROUPS.VIEW(groupSlug))}`}
        className={className}
      >
        <UserPlus className="h-4 w-4 mr-2" />
        Sign in to join
      </Button>
    );
  }

  const handleJoin = async () => {
    try {
      setJoining(true);
      const result = await groupsService.joinGroup(groupId);
      if (result.success) {
        toast.success('Successfully joined group!');
        onJoined?.();
      } else {
        toast.error(apiErrorMessage(result, 'Failed to join group'));
      }
    } catch (error) {
      logger.error('Failed to join group:', error);
      toast.error('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  return (
    <Button variant="primary" onClick={handleJoin} disabled={joining} className={className}>
      <UserPlus className="h-4 w-4 mr-2" />
      {joining ? 'Joining...' : 'Join group'}
    </Button>
  );
}
