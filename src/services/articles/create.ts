/**
 * Publish an article. Reuses the timeline post-creation pipeline
 * (`createEventWithVisibility`) verbatim — an article is a long-form post — and
 * carries its long-form payload in `metadata.article`. No new table, no new RPC.
 */

import { timelineService } from '@/services/timeline';
import { logger } from '@/utils/logger';
import { ARTICLE_EVENT_TYPE, buildArticleSlug, shortToken } from '@/config/articles';
import { buildArticleMetadata, validateArticleInput } from './write-shared';
import type { CreateArticleInput } from './types';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import { buildTimelineContexts } from '@/services/timeline/utils/timeline-contexts';
import { fetchUserProjects } from '@/services/timeline/utils/post-composer';
import { ownedProjectIds } from './project-walls';

interface PublishArticleUser {
  id: string;
}

type PublishArticleResult = { success: true; slug: string } | { success: false; error: string };

/** Keep only the requested projects the writer owns; ask the database only when some were requested. */
async function ownProjects(userId: string, requested: string[] | undefined): Promise<string[]> {
  if (!requested?.length) {
    return [];
  }
  return ownedProjectIds(requested, await fetchUserProjects(userId));
}

export async function publishArticle(
  user: PublishArticleUser,
  input: CreateArticleInput
): Promise<PublishArticleResult> {
  const validation = validateArticleInput(input, 'publish');
  if (!validation.success) {
    return validation;
  }
  const { title, body, excerpt, coverImage } = validation.value;
  const slug = buildArticleSlug(title, shortToken());

  // The writer's profile, each of their own projects they chose, and the
  // community feed when public — the same contexts a short post builds.
  const projectIds = await ownProjects(user.id, input.projectIds);
  const timelineContexts = buildTimelineContexts(
    'profile',
    user.id,
    user.id,
    projectIds,
    input.visibility
  );

  const result = await timelineService.createEventWithVisibility({
    eventType: ARTICLE_EVENT_TYPE,
    actorId: user.id,
    subjectType: 'profile',
    subjectId: user.id,
    title,
    description: excerpt,
    visibility: input.visibility,
    metadata: buildArticleMetadata({ title, body, excerpt, coverImage, slug }),
    timelineContexts,
  });

  if (!result.success) {
    logger.error('Failed to publish article', { error: result.error }, 'Articles');
    return { success: false, error: apiErrorMessage(result, 'Failed to publish article.') };
  }

  return { success: true, slug };
}
