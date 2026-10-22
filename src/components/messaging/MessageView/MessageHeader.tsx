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
import Button from '@/components/ui/Button';
import AvatarLink from '@/components/ui/AvatarLink';
import { getConversationDisplayName } from '@/features/messaging/lib/conversation-display';
import type { Conversation, Participant } from '@/features/messaging/types';

interface MessageHeaderProps {
  conversation: Conversation;
  currentUserId: string | undefined;
  onBack: () => void;
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
  const displayName = getConversationDisplayName(conversation, currentUserId);
  const primaryParticipant = getPrimaryParticipant(conversation, currentUserId);

  const subtitle = conversation.is_group
    ? `${conversation.participants?.length || 0} members`
    : 'Direct message';

  return (
    <div className="flex items-center justify-between p-4 border-b border-default bg-surface-base">
      <div className="flex min-w-0 flex-1 items-center gap-3">
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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-fg-primary">
            <Users className="w-5 h-5" />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          {primaryParticipant && !conversation.is_group ? (
            <Link
              href={
                primaryParticipant.username
                  ? `/profiles/${encodeURIComponent(primaryParticipant.username)}`
                  : primaryParticipant.user_id
                    ? `/profiles/${encodeURIComponent(primaryParticipant.user_id)}`
                    : '#'
              }
              className="hover:underline"
            >
              <h2 className="break-words text-base font-semibold text-fg-primary">{displayName}</h2>
            </Link>
          ) : (
            <h2 className="break-words text-base font-semibold text-fg-primary">{displayName}</h2>
          )}
          <p className="truncate text-sm text-fg-secondary">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
