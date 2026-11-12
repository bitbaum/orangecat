import type { Metadata } from 'next';
import Link from 'next/link';
import { Rss } from 'lucide-react';
import { getPublishedPosts, getFeaturedPost, getAllTags } from '@/lib/blog';
import BlogClientWrapper from '@/components/blog/BlogClientWrapper';
import { PageHeading } from '@/components/layout/PageHeading';
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
    <div className="min-h-screen pt-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <PageHeading className="mb-4">OrangeCat Blog</PageHeading>
          <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
            Insights, guides, and stories about economic freedom, Bitcoin, and building on OrangeCat
          </p>
          <Link
            href={ROUTES.RSS}
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
          >
            <Rss className="h-4 w-4" />
            Subscribe via RSS
          </Link>
        </div>

        <BlogClientWrapper posts={allPosts} featuredPost={featuredPost} tags={allTags} />
      </div>
    </div>
  );
}
