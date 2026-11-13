import type { Metadata } from 'next';
import Link from 'next/link';
import { Rss } from 'lucide-react';
import { getPublishedPosts, getFeaturedPost, getAllTags } from '@/lib/blog';
import BlogClientWrapper from '@/components/blog/BlogClientWrapper';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { APP_NAME } from '@/config/brand';
import { ROUTES } from '@/config/routes';
import { pageMetadata } from '@/lib/seo/metadata';

const BLOG_TITLE = `${APP_NAME} Blog`;
const BLOG_DESCRIPTION =
  'Insights, guides, and stories about economic freedom, Bitcoin, and building on OrangeCat.';

export const metadata: Metadata = pageMetadata({
  title: 'Blog',
  shareTitle: BLOG_TITLE,
  description: BLOG_DESCRIPTION,
  path: ROUTES.BLOG,
});

export default function BlogPage() {
  const allPosts = getPublishedPosts();
  const featuredPost = getFeaturedPost();
  const allTags = getAllTags();

  return (
    <div className="min-h-screen bg-surface-page">
      <div className={PUBLIC_PAGE_WIDTH.wide}>
        <PublicPageHeader
          title="OrangeCat Blog"
          lede="Insights, guides, and stories about economic freedom, Bitcoin, and building on OrangeCat"
          meta={
            <Link
              href={ROUTES.RSS}
              className="inline-flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 text-fg-secondary transition-colors hover:text-fg-primary"
            >
              <Rss className="h-4 w-4" aria-hidden />
              Subscribe via RSS
            </Link>
          }
        />

        <BlogClientWrapper posts={allPosts} featuredPost={featuredPost} tags={allTags} />
      </div>
    </div>
  );
}
