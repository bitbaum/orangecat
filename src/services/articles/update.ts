/**
 * Edit / delete an article. An article is a timeline_events row, so these wrap
 * the existing timeline mutations (updateEvent / deleteEvent) — RLS enforces
 * that only the author can change or remove it. The slug is preserved on edit so
 * the article's URL never breaks.
 */

import { updateEvent, deleteEvent } from '@/services/timeline/mutations/events';
import { logger } from '@/utils/logger';
import { buildArticleMetadata, validateArticleInput } from './write-shared';
import type { CreateArticleInput } from './types';
import { apiErrorMessage } from '@/lib/api/errorMessage';

type ArticleWriteResult = { success: true } | { success: false; error: string };

export async function updateArticle(
  article: { id: string; slug: string },
  input: CreateArticleInput
): Promise<ArticleWriteResult> {
  const validation = validateArticleInput(input, 'save');
  if (!validation.success) {
    return validation;
  }
  const { title, body, excerpt, coverImage } = validation.value;

  const result = await updateEvent(article.id, {
    title,
    description: excerpt,
    visibility: input.visibility,
    // slug preserved — never regenerate on edit, so the article URL stays stable.
    metadata: buildArticleMetadata({ title, body, excerpt, coverImage, slug: article.slug }),
  });

  if (!result.success) {
    logger.error('Failed to update article', { error: result.error }, 'Articles');
    return { success: false, error: apiErrorMessage(result, 'Failed to save changes.') };
  }
  return { success: true };
}

export async function deleteArticle(articleId: string): Promise<ArticleWriteResult> {
  const ok = await deleteEvent(articleId);
  return ok ? { success: true } : { success: false, error: 'Could not delete this article.' };
}
