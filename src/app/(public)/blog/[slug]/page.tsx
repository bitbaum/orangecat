import { Metadata } from 'next';
import { notFound } from 'next/navigation';

// Filesystem-sourced markdown. Static generation with hourly revalidation
// gives the CDN cache back; force-dynamic was wasteful here.
export const revalidate = 3600;
import { Calendar, Clock, ArrowLeft, Users, Tag } from 'lucide-react';
import Link from 'next/link';
import { Toc, ReadingProgress } from 'bip-kit/react';
import 'bip-kit/styles.css';
import '@/lib/longform/longform.css';
import { getBlogPost, getBlogPostSlugs } from '@/lib/blog';
import { parseLongform } from '@/lib/longform/parse';
import LongformBody from '@/lib/longform/LongformBody';
import Button from '@/components/ui/Button';
import { JsonLdScript } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import BlogShareButton from './BlogShareButton';
import { GRADIENTS } from '@/config/gradients';
import { ROUTES } from '@/config/routes';
import { APP_LOCALE } from '@/utils/locale';

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

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
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
      description: post.excerpt,
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
  // same parse and renderer the community articles surface uses.
  const { blocks, toc } = parseLongform(post.content);

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
      <div className="min-h-screen pt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-6xl">
            {/* Back to Blog */}
            <div className="mb-8">
              <Link href={ROUTES.BLOG}>
                <Button variant="outline" className="mb-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Blog
                </Button>
              </Link>
            </div>

            {/* Article Header */}
            <header className="mb-12 max-w-4xl">
              {post.featured && (
                <div className="flex items-center text-sm text-fg-primary mb-4 font-medium">
                  <span className="bg-surface-raised px-3 py-1 rounded-full">Featured Article</span>
                </div>
              )}
              <h1 className="text-4xl md:text-5xl font-bold text-fg-primary mb-6 leading-tight">
                {post.title}
              </h1>
              <p className="text-xl text-fg-secondary leading-relaxed mb-6">{post.excerpt}</p>

              {/* Post Meta */}
              <div className="flex items-center text-sm text-fg-secondary border-t border-b border-default py-4">
                <Calendar className="w-4 h-4 mr-2" />
                {new Date(post.date).toLocaleDateString(APP_LOCALE, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                <Clock className="w-4 h-4 ml-6 mr-2" />
                {post.readTime}
                {post.author && (
                  <>
                    <Users className="w-4 h-4 ml-6 mr-2" />
                    {post.author}
                  </>
                )}
              </div>

              {/* Tags */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {post.tags.map(tag => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-surface-raised text-fg-primary hover:bg-surface-raised/80 transition-colors"
                    >
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </header>

            {/* Article Content — sticky TOC rail on xl; the article column
                keeps bip-kit's measured line length regardless. Toc hides
                itself under 3 headings, so short posts render one column. */}
            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:items-start xl:gap-10">
              <article>
                <LongformBody blocks={blocks} />
              </article>
              <aside className="hidden xl:block">
                <Toc items={toc} />
              </aside>
            </div>

            <div className="max-w-4xl">
              {/* Share and Navigation */}
              <div className="mt-16 pt-8 border-t border-default">
                <div className="flex flex-col sm:flex-row justify-between items-center">
                  <Link href={ROUTES.BLOG}>
                    <Button variant="outline">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back to Blog
                    </Button>
                  </Link>
                  <div className="mt-4 sm:mt-0 flex flex-col items-center gap-3">
                    <BlogShareButton
                      title={post.title}
                      description={post.excerpt}
                      url={`${SITE_URL}/blog/${slug}`}
                    />
                    <p className="text-fg-secondary text-xs">
                      Part of our commitment to building in public
                    </p>
                  </div>
                </div>
              </div>

              {/* Related Posts CTA */}
              <div className={`mt-12 ${GRADIENTS.sectionOrangeTiffany} rounded-lg p-8 text-center`}>
                <h3 className="text-2xl font-bold text-fg-primary mb-4">More from {APP_NAME}</h3>
                <p className="text-lg text-fg-primary mb-6">
                  Discover more insights about Bitcoin, security, and building in public.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href={ROUTES.BLOG}>
                    <Button size="lg" className={GRADIENTS.btnOrange}>
                      Read More Articles
                    </Button>
                  </Link>
                  <Link href={ROUTES.AUTH_REGISTER}>
                    <Button variant="outline" size="lg">
                      Join {APP_NAME}
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
