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

interface PublishArticleUser {
  id: string;
}

type PublishArticleResult = { success: true; slug: string } | { success: false; error: string };

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

  // Owner (profile) timeline + community feed when public — mirrors the short-post
  // distribution contexts so articles surface everywhere posts do.
  const timelineContexts: Array<{
    timeline_type: 'profile' | 'project' | 'community';
    timeline_owner_id: string | null;
  }> = [{ timeline_type: 'profile', timeline_owner_id: user.id }];
  if (input.visibility === 'public') {
    timelineContexts.push({ timeline_type: 'community', timeline_owner_id: null });
  }

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
