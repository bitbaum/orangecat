import { fromTable } from '@/lib/supabase/untyped';
import supabase from '@/lib/supabase/browser';
import { logger } from '@/utils/logger';
import { TimelineVisibility } from '@/types/timeline';
import { getTableName } from '@/config/entity-registry';
import { DATABASE_TABLES, STORAGE_BUCKETS } from '@/config/database-tables';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_STATUS } from '@/config/database-constants';
import { TIMELINE_CONTENT_LIMITS } from '@/config/timeline';
import { timelineService } from '@/services/timeline';
import { offlineQueueService } from '@/lib/offline-queue';
import type { TimelineSubjectType, TimelineDisplayEvent, PostImageMeta } from '@/types/timeline';
import {
  getEventIcon,
  getEventDisplayType,
  getTimeAgo,
  isEventRecent,
} from '@/services/timeline/formatters';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const PROFILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const profileCheckCache = new Map<string, { exists: boolean; timestamp: number }>();

/**
 * Checks whether the current user has a profile, with caching.
 * Returns true if profile exists, false otherwise.
 */
async function ensureProfileExists(userId: string): Promise<boolean> {
  const cached = profileCheckCache.get(userId);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_DURATION) {
    return cached.exists;
  }

  try {
    const response = await fetch(API_ROUTES.PROFILE);
    const exists = response.ok;
    profileCheckCache.set(userId, { exists, timestamp: Date.now() });

    if (!exists) {
      logger.warn(
        'Profile not found, user may need to complete setup',
        { userId },
        'usePostComposer'
      );
    }

    return exists;
  } catch (err) {
    logger.error('Failed to ensure profile exists', err, 'usePostComposer');
    return false;
  }
}

interface OptimisticEventUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
  };
}

interface CreateOptimisticEventParams {
  user: OptimisticEventUser;
  content: string;
  subjectType: string;
  subjectId?: string;
  visibility: TimelineVisibility;
  selectedProjects: string[];
  parentEventId?: string;
  image?: PostImageMeta;
}

/**
 * Creates an optimistic event object for immediate UI display
 * before the server confirms the post creation.
 */
function createOptimisticEvent(params: CreateOptimisticEventParams): TimelineDisplayEvent {
  const {
    user,
    content,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image,
  } = params;

  const optimisticId = `optimistic-${Date.now()}-${Math.random()}`;
  const now = new Date().toISOString();

  const displayName =
    user.user_metadata?.name ||
    (typeof user.email === 'string' && user.email.includes('@')
      ? user.email.split('@')[0]
      : null) ||
    'You';
  const username =
    (typeof user.email === 'string' && user.email.includes('@')
      ? user.email.split('@')[0]
      : null) || user.id;

  return {
    id: optimisticId,
    actorId: user.id,
    actorType: 'user',
    subjectType: subjectType as TimelineSubjectType,
    subjectId: subjectId || user.id,
    title: '',
    description: content,
    visibility,
    isFeatured: false,
    isDeleted: false,
    metadata: {
      is_user_post: true,
      cross_posted: subjectId && subjectId !== user.id,
      cross_posted_projects: selectedProjects.length > 0 ? selectedProjects : undefined,
      is_optimistic: true,
      is_reply: !!parentEventId,
      ...(image ? { image } : {}),
    },
    parentEventId,
    eventTimestamp: now,
    createdAt: now,
    updatedAt: now,
    actor: {
      id: user.id,
      name: displayName,
      username,
      avatar: user.user_metadata?.avatar_url,
      type: 'user',
    },
    icon: getEventIcon('status_update'),
    displayType: getEventDisplayType('status_update'),
    timeAgo: getTimeAgo(now),
    isRecent: isEventRecent(now),
    likesCount: 0,
    sharesCount: 0,
    commentsCount: 0,
  };
}

/**
 * Formats a caught error from post creation into a user-friendly message.
 */
export function formatPostError(err: unknown): string {
  const e = err as { response?: { status?: number } };
  if (e.response && e.response.status) {
    switch (e.response.status) {
      case 400:
        return 'Invalid post content. Please review your post.';
      case 401:
        return 'You must be logged in to post. Please refresh and try again.';
      case 403:
        return "You don't have permission to perform this action.";
      case 500:
      case 502:
      case 503:
      case 504:
        return 'A server error occurred. Our team has been notified. Please try again later.';
      default:
        return `An error occurred (code: ${e.response.status}). Please try again.`;
    }
  }

  if (err instanceof Error) {
    if (err.message.includes('Unable to verify your profile')) {
      return err.message;
    }
    if (err.message.includes('Authentication required')) {
      return 'You must be logged in to post. Please refresh and try again.';
    }
    if (err.message.includes('Failed to create post')) {
      return err.message;
    }
    if (err.message.includes('network') || err.message.includes('fetch')) {
      return 'A network error occurred. Please check your connection and try again.';
    }
    return err.message || 'An unexpected error occurred. Please try again.';
  }

  if (typeof err === 'string') {
    return err;
  }

  return 'An unexpected error occurred.';
}

/**
 * Truncates post content into a title that satisfies a DB NOT NULL constraint.
 */
function truncateToTitle(postContent: string): string {
  return postContent.length <= TIMELINE_CONTENT_LIMITS.title
    ? postContent
    : `${postContent.slice(0, TIMELINE_CONTENT_LIMITS.titleTruncateAt).trimEnd()}...`;
}

/**
 * Builds timeline visibility context entries for a post.
 */
function buildTimelineContexts(
  subjectType: string,
  subjectId: string | undefined,
  userId: string,
  selectedProjects: string[],
  visibility: TimelineVisibility,
  parentEventId?: string
): Array<{
  timeline_type: 'profile' | 'project' | 'community';
  timeline_owner_id: string | null;
}> {
  const contexts: Array<{
    timeline_type: 'profile' | 'project' | 'community';
    timeline_owner_id: string | null;
  }> = [];

  contexts.push({
    timeline_type: subjectType as 'profile' | 'project',
    timeline_owner_id: subjectId || userId,
  });

  selectedProjects.forEach(projectId => {
    contexts.push({
      timeline_type: 'project',
      timeline_owner_id: projectId,
    });
  });

  if (visibility === 'public' && !parentEventId) {
    contexts.push({
      timeline_type: 'community',
      timeline_owner_id: null,
    });
  }

  return contexts;
}

// =============================================================================
// POST SUBMISSION
// =============================================================================

export interface UserProject {
  id: string;
  title: string;
  description?: string;
  status: string;
  contributor_count?: number;
  thumbnail_url: string | null;
}

interface PostSubmitOptions {
  user: OptimisticEventUser;
  content: string;
  subjectType: TimelineSubjectType;
  subjectId?: string;
  visibility: TimelineVisibility;
  selectedProjects: string[];
  parentEventId?: string;
  image?: PostImageMeta;
  onOptimisticUpdate?: (event: TimelineDisplayEvent) => void;
}

type PostSubmitResult =
  | { success: true; event: TimelineDisplayEvent | undefined }
  | { success: false; error: string };

/**
 * Submits a post to the timeline service.
 * Fires the optimistic update callback before the network call so the UI
 * responds immediately.
 */
export async function submitPost(options: PostSubmitOptions): Promise<PostSubmitResult> {
  const {
    user,
    content,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image,
    onOptimisticUpdate,
  } = options;

  const profileExists = await ensureProfileExists(user.id);
  if (!profileExists) {
    throw new Error(
      'Unable to verify your profile. Please refresh the page and try again. If the problem persists, you may need to complete your profile setup.'
    );
  }

  const postContent = content.trim();
  const title = truncateToTitle(postContent);

  const optimisticEvent = createOptimisticEvent({
    user,
    content: postContent,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image,
  });
  onOptimisticUpdate?.(optimisticEvent);

  const timelineContexts = buildTimelineContexts(
    subjectType,
    subjectId,
    user.id,
    selectedProjects,
    visibility,
    parentEventId
  );

  const result = parentEventId
    ? await timelineService.createEvent({
        eventType: 'status_update',
        actorId: user.id,
        subjectType,
        subjectId: subjectId || user.id,
        title,
        description: postContent,
        visibility,
        metadata: { is_user_post: true, is_reply: true, ...(image ? { image } : {}) },
        parentEventId,
      })
    : await timelineService.createEventWithVisibility({
        eventType: 'status_update',
        actorId: user.id,
        subjectType,
        subjectId: subjectId || user.id,
        title,
        description: postContent,
        visibility,
        metadata: {
          is_user_post: true,
          cross_posted_count: selectedProjects.length,
          ...(image ? { image } : {}),
        },
        timelineContexts,
      });

  if (!result.success) {
    const errorMsg = apiErrorMessage(result, 'Failed to create post');
    logger.error('Post creation failed', { error: errorMsg, result }, 'usePostComposer');
    return { success: false, error: errorMsg };
  }

  return { success: true, event: result.event as TimelineDisplayEvent | undefined };
}

/**
 * Queues a post for offline delivery and fires the optimistic update callback
 * with an offline-tagged event so the UI can show it as queued.
 */
export async function queueOfflinePost(options: PostSubmitOptions): Promise<void> {
  const {
    user,
    content,
    subjectType,
    subjectId,
    visibility,
    selectedProjects,
    parentEventId,
    image,
    onOptimisticUpdate,
  } = options;

  const postContent = content.trim();

  await offlineQueueService.addToQueue(
    {
      eventType: 'status_update',
      actorId: user.id,
      subjectType,
      subjectId: subjectId || user.id,
      title: truncateToTitle(postContent),
      description: postContent,
      visibility,
      metadata: {
        is_user_post: true,
        cross_posted: subjectId && subjectId !== user.id,
        cross_posted_projects: selectedProjects.length > 0 ? selectedProjects : undefined,
        ...(image ? { image } : {}),
      },
    },
    user.id
  );

  if (onOptimisticUpdate) {
    const offlineEvent = createOptimisticEvent({
      user,
      content: postContent,
      subjectType,
      subjectId,
      visibility,
      selectedProjects,
      parentEventId,
      image,
    });
    offlineEvent.id = `offline-${Date.now()}`;
    offlineEvent.metadata = {
      ...offlineEvent.metadata,
      is_offline_queued: true,
      offline_queued_at: new Date().toISOString(),
    };
    onOptimisticUpdate(offlineEvent);
  }
}

/**
 * Fetches user projects with thumbnails for the project selector.
 * Returns processed project list or empty array on failure.
 */
export async function fetchUserProjects(userId: string): Promise<UserProject[]> {
  try {
    // Resolve user to actor for ownership filtering

    const { data: actor } = (await fromTable(supabase, DATABASE_TABLES.ACTORS)
      .select('id')
      .eq('user_id', userId)
      .eq('actor_type', 'user')
      .maybeSingle()) as { data: { id: string } | null };

    if (!actor) {
      return [];
    }

    const { data, error } = await supabase
      .from(getTableName('project'))
      .select(
        `
        id,
        title,
        description,
        status,
        contributor_count,
        project_media(id, storage_path, position)
      `
      )
      .eq('actor_id', actor.id)
      .neq('status', ENTITY_STATUS.DRAFT)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return (data || []).map((project): UserProject => {
      let thumbnail_url: string | null = null;
      if (project.project_media && project.project_media.length > 0) {
        const firstMedia = project.project_media.sort((a, b) => a.position - b.position)[0];
        if (firstMedia?.storage_path) {
          const { data: urlData } = supabase.storage
            .from(STORAGE_BUCKETS.PROJECT_MEDIA)
            .getPublicUrl(firstMedia.storage_path);
          thumbnail_url = urlData.publicUrl;
        }
      }
      const { project_media: _pm, description, contributor_count, ...rest } = project;
      return {
        ...rest,
        title: rest.title ?? '',
        status: rest.status ?? '',
        description: description ?? undefined,
        contributor_count: contributor_count ?? undefined,
        thumbnail_url,
      };
    });
  } catch (err) {
    logger.warn('Failed to load user projects (non-blocking)', err, 'usePostComposer');
    return [];
  }
}
