import type { Metadata } from 'next';
import Link from 'next/link';
import { Rss } from 'lucide-react';
import { getPublishedPosts, getFeaturedPost, getAllTags } from '@/lib/blog';
import BlogClientWrapper from '@/components/blog/BlogClientWrapper';
import { PageHeading } from '@/components/layout/PageHeading';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';

const BLOG_TITLE = `${APP_NAME} Blog`;
const BLOG_DESCRIPTION =
  'Insights, guides, and stories about economic freedom, Bitcoin, and building on OrangeCat.';

export const metadata: Metadata = {
  title: 'Blog',
  description: BLOG_DESCRIPTION,
  alternates: { canonical: `${SITE_URL}${ROUTES.BLOG}` },
  // Without page-level OG the index inherited the root layout's homepage
  // og:title/og:url verbatim — shares of /blog looked like shares of the
  // homepage.
  openGraph: {
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
    url: `${SITE_URL}${ROUTES.BLOG}`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: BLOG_TITLE,
    description: BLOG_DESCRIPTION,
  },
};

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
            className="mt-4 inline-flex min-h-9 pointer-coarse:min-h-11 items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
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
