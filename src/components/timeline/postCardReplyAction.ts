import type { TimelineDisplayEvent } from '@/types/timeline';
import type { User } from '@supabase/supabase-js';
import { logger } from '@/utils/logger';
import { timelineService } from '@/services/timeline';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface SubmitReplyParams {
  replyText: string;
  isReplying: boolean;
  user: User | null | undefined;
  event: TimelineDisplayEvent;
  setIsReplying: (v: boolean) => void;
  setReplyText: (v: string) => void;
  setShowReplyInput: (v: boolean) => void;
  onReplyCreated?: (reply: TimelineDisplayEvent) => void;
  onUpdate: (updates: Partial<TimelineDisplayEvent>) => void;
}

export async function submitReplyAction({
  replyText,
  isReplying,
  user,
  event,
  setIsReplying,
  setReplyText,
  setShowReplyInput,
  onReplyCreated,
  onUpdate,
}: SubmitReplyParams): Promise<void> {
  const text = replyText.trim();
  if (!text || isReplying || !user) {
    return;
  }
  setIsReplying(true);
  try {
    const title = text.length <= 120 ? text : `${text.slice(0, 117).trimEnd()}...`;
    const result = await timelineService.createEvent({
      eventType: 'status_update',
      actorId: user.id,
      subjectType: event.subject?.type || 'profile',
      subjectId: event.subject?.id || event.actor.id,
      title,
      description: text,
      visibility: event.visibility,
      metadata: { is_user_post: true, is_reply: true },
      parentEventId: event.id,
    });
    if (!result.success || !result.event) {
      throw new Error(apiErrorMessage(result, 'Failed to reply'));
    }
    const hydrated = await timelineService.getEventById(result.event.id);
    setReplyText('');
    setShowReplyInput(false);
    if (hydrated.success && hydrated.event) {
      onReplyCreated?.(hydrated.event);
    }
    onUpdate({
      commentsCount: (event.commentsCount || event.replyCount || 0) + 1,
      replyCount: (event.replyCount || 0) + 1,
    });
  } catch (error) {
    logger.error('Failed to post reply', error, 'PostCard');
  } finally {
    setIsReplying(false);
  }
}
