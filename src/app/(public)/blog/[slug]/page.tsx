import { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Filesystem-sourced markdown. Static generation with hourly revalidation
// gives the CDN cache back; force-dynamic was wasteful here.
export const revalidate = 3600;
import { Calendar, Clock, ArrowLeft, Users, Tag } from 'lucide-react';
import Link from 'next/link';
import { Toc, ReadingProgress } from '@bitbaum/bip-kit/react';
import '@bitbaum/bip-kit/styles.css';
import '@/lib/longform/longform.css';
import { getBlogPost, getBlogPostSlugs, getPublishedPosts } from '@/lib/blog';
import LongformBody from '@/lib/longform/LongformBody';
import Button from '@/components/ui/Button';
import { metaDescription } from '@/lib/og/share-line';
import { JsonLdScript } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import BlogShareButton from './BlogShareButton';
import { ROUTES } from '@/config/routes';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Generate static paths for all blog posts
export async function generateStaticParams() {
  const slugs = getBlogPostSlugs();
  return slugs.map(slug => ({ slug }));
}

// Generate metadata for each blog post
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  // Dynamically rendered share card — without an image, chat apps and social
  // feeds show a bare text link.
  const ogImage = `${SITE_URL}/api/og/blog/${slug}`;
  const description = metaDescription(post.excerpt);

  return {
    title: post.title,
    description,
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
    openGraph: {
      title: post.title,
      description,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author || `${APP_NAME} Team`],
      tags: post.tags,
      url: `${SITE_URL}/blog/${slug}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function BlogPost({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  // ONE long-form pipeline: bip-kit typed blocks + reference renderer — the
  // same normalization, parse and renderer the community articles use.
  const { blocks, toc } = post;

  // Newest first, so the post before this one in the list is the newer one.
  const posts = getPublishedPosts();
  const index = posts.findIndex(p => p.slug === slug);
  const newer = index > 0 ? posts[index - 1] : null;
  const older = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    author: {
      '@type': 'Person',
      name: post.author || `${APP_NAME} Team`,
    },
    publisher: {
      '@type': 'Organization',
      name: APP_NAME,
      url: SITE_URL,
    },
    url: `${SITE_URL}/blog/${slug}`,
    ...(post.tags?.length && { keywords: post.tags.join(', ') }),
  };

  return (
    <>
      <JsonLdScript data={articleJsonLd} />
      <ReadingProgress />
      <div className="min-h-screen bg-surface-page pt-20 pb-24 text-fg-primary">
        {/* The same frame as a community article (/articles/[slug]): one
            680px column holds the back link, the header and the text, so the
            title, the byline and the first line share one left edge. */}
        <article className="mx-auto w-full max-w-[680px] px-5">
          <Link
            href={ROUTES.BLOG}
            className="mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Blog
          </Link>

          <header className="mb-10">
            {post.featured && (
              <p className="mb-4 text-sm font-medium text-fg-primary">
                <span className="rounded-full bg-surface-raised px-3 py-1">Featured Article</span>
              </p>
            )}
            <h1 className="font-heading text-4xl font-bold leading-tight tracking-display text-fg-primary sm:text-5xl">
              {post.title}
            </h1>
            <p className="mb-0 mt-5 text-xl leading-relaxed text-fg-secondary">{post.excerpt}</p>

            <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-subtle py-4 text-sm text-fg-secondary">
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" aria-hidden />
                <time dateTime={post.date}>
                  <FormattedDate value={post.date} mode="long" />
                </time>
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4" aria-hidden />
                {post.readTime}
              </span>
              {post.author && (
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden />
                  {post.author}
                </span>
              )}
            </div>

            {post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map(tag => (
                  <Link
                    key={tag}
                    href={`${ROUTES.BLOG}?tag=${encodeURIComponent(tag)}`}
                    className="inline-flex min-h-11 items-center rounded-full bg-surface-raised px-3 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-overlay"
                  >
                    <Tag className="mr-1 h-3 w-3" aria-hidden />
                    {tag}
                  </Link>
                ))}
              </div>
            )}
          </header>

          {/* On xl the TOC gets a rail to the right of the column; it hides
              itself under 3 headings. */}
          <div className="xl:relative">
            <div className="[&_.bp-article]:px-0 [&>.bp-article>*:first-child]:mt-0">
              <LongformBody blocks={blocks} />
            </div>
            <aside className="hidden xl:absolute xl:left-full xl:top-0 xl:ml-12 xl:block xl:h-full xl:w-[240px]">
              <Toc items={toc} />
            </aside>
          </div>

          <footer className="mt-14 border-t border-subtle pt-8">
            <div className="flex flex-col items-start gap-3">
              <BlogShareButton
                title={post.title}
                description={post.excerpt}
                url={`${SITE_URL}/blog/${slug}`}
              />
            </div>

            {(newer || older) && (
              <nav aria-label="More posts" className="mt-10 grid gap-4 sm:grid-cols-2">
                {older ? (
                  <Link
                    href={`${ROUTES.BLOG}/${older.slug}`}
                    className="flex min-h-11 flex-col rounded-lg border border-default p-4 transition-colors hover:border-fg-primary"
                  >
                    <span className="text-xs text-fg-secondary">Previous post</span>
                    <span className="mt-1 font-medium text-fg-primary">{older.title}</span>
                  </Link>
                ) : (
                  <span aria-hidden className="hidden sm:block" />
                )}
                {newer && (
                  <Link
                    href={`${ROUTES.BLOG}/${newer.slug}`}
                    className="flex min-h-11 flex-col rounded-lg border border-default p-4 text-left transition-colors hover:border-fg-primary sm:text-right"
                  >
                    <span className="text-xs text-fg-secondary">Next post</span>
                    <span className="mt-1 font-medium text-fg-primary">{newer.title}</span>
                  </Link>
                )}
              </nav>
            )}

            <div className="mt-12 rounded-lg border border-default bg-surface-raised p-8 text-center">
              <h2 className="text-2xl font-bold text-fg-primary">More from {APP_NAME}</h2>
              <p className="mx-auto mb-6 mt-3 max-w-md text-fg-secondary">
                Discover more insights about Bitcoin, security, and building in public.
              </p>
              <Button href={ROUTES.AUTH_REGISTER} variant="accent" size="lg">
                Join {APP_NAME}
              </Button>
            </div>
          </footer>
        </article>
      </div>
    </>
  );
}
