/**
 * GET /api/og/article/[slug] — 1200×630 share card for a community article.
 *
 * Public articles only: getArticleBySlug already gates non-public articles to
 * their author, and an anonymous previewer bot carries no session — so private
 * drafts 404 here by construction. Node.js runtime for parity with the blog
 * card (shared renderer).
 */

import { getArticleBySlug } from '@/services/articles/get-article';
import { contentCardResponse } from '@/lib/og/content-card';
import { APP_LOCALE } from '@/utils/locale';

export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article || article.visibility !== 'public') {
    return new Response('Not found', { status: 404 });
  }

  const date = new Date(article.publishedAt).toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return contentCardResponse({
    kicker: 'Article',
    title: article.title,
    meta: [date, `${article.readingTime} min read`, article.author.name],
  });
}
