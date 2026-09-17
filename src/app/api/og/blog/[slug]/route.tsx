/**
 * GET /api/og/blog/[slug] — 1200×630 share card for a blog post.
 *
 * Mirrors the profile OG route pattern, but runs on the Node.js runtime (no
 * `runtime = 'edge'` export): blog posts live on the filesystem and @/lib/blog
 * reads them with fs, which the edge runtime does not have.
 */

import { getBlogPost } from '@/lib/blog';
import { contentCardResponse } from '@/lib/og/content-card';
import { APP_NAME } from '@/config/brand';
import { APP_LOCALE } from '@/utils/locale';

export const contentType = 'image/png';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return new Response('Not found', { status: 404 });
  }

  const date = new Date(post.date).toLocaleDateString(APP_LOCALE, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return contentCardResponse({
    kicker: `${APP_NAME} Blog`,
    title: post.title,
    meta: [date, post.readTime, post.author ?? ''],
    tags: post.tags,
  });
}
