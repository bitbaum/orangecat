'use client';

/**
 * Message View Header Component
 *
 * Displays conversation header with back button, avatar, and participant info.
 *
 * @module messaging/MessageView/MessageHeader
 */

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GRADIENTS } from '@/config/gradients';
import Button from '@/components/ui/Button';
import AvatarLink from '@/components/ui/AvatarLink';
import type { Conversation, Participant } from '@/features/messaging/types';
import { optionalPublicProfilePath } from '@/config/public-profile-path';

interface MessageHeaderProps {
  conversation: Conversation;
  currentUserId: string | undefined;
  onBack: () => void;
}

/**
 * Get the display name for a conversation
 */
function getDisplayName(conversation: Conversation, currentUserId: string | undefined): string {
  if (conversation.title) {
    return conversation.title;
  }

  const participants = conversation.participants || [];
  const otherParticipants = participants.filter(
    p => p && p.is_active && p.user_id !== currentUserId
  );

  if (otherParticipants.length === 1) {
    return otherParticipants[0].name || otherParticipants[0].username || 'Unknown User';
  }

  if (otherParticipants.length === 0) {
    return 'Notes to Self';
  }

  return (
    otherParticipants
      .slice(0, 3)
      .map(p => p.name || p.username)
      .join(', ') + (otherParticipants.length > 3 ? ` +${otherParticipants.length - 3}` : '')
  );
}

/**
 * Get the primary participant for direct messages
 */
function getPrimaryParticipant(
  conversation: Conversation,
  currentUserId: string | undefined
): Participant | null {
  if (conversation.is_group) {
    return null;
  }

  const participants = conversation.participants || [];
  return participants.find(p => p && p.is_active && p.user_id !== currentUserId) || null;
}

export default function MessageHeader({ conversation, currentUserId, onBack }: MessageHeaderProps) {
  const displayName = getDisplayName(conversation, currentUserId);
  const primaryParticipant = getPrimaryParticipant(conversation, currentUserId);
  const profileHref = optionalPublicProfilePath(primaryParticipant?.username);

  const subtitle = conversation.is_group
    ? `${conversation.participants?.length || 0} members`
    : 'Direct message';

  return (
    <div className="flex items-center justify-between p-4 border-b border-default bg-surface-base">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="p-2 min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {primaryParticipant ? (
          <AvatarLink
            username={primaryParticipant.username || null}
            userId={primaryParticipant.user_id || null}
            avatarUrl={primaryParticipant.avatar_url || null}
            name={primaryParticipant.name || null}
            size={40}
            className="flex-shrink-0"
          />
        ) : conversation.is_group ? (
          <div
            className={cn(
              GRADIENTS.brandTiffanyBr,
              'w-10 h-10 rounded-full flex items-center justify-center text-white'
            )}
          >
            <Users className="w-5 h-5" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {profileHref ? (
            <Link href={profileHref} className="hover:underline">
              <h2 className="truncate font-semibold text-fg-primary">{displayName}</h2>
            </Link>
          ) : (
            <h2 className="truncate font-semibold text-fg-primary">{displayName}</h2>
          )}
          <p className="truncate text-sm text-fg-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
