import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Lock, Users } from 'lucide-react';
import { getArticleBySlug, isCurrentUserArticleAuthor } from '@/services/articles/get-article';
import { ARTICLE_COPY } from '@/config/articles';
import { ROUTES } from '@/config/routes';
import { JsonLdScript } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { Toc, ReadingProgress } from 'bip-kit/react';
import 'bip-kit/styles.css';
import '@/lib/longform/longform.css';
import { parseLongform } from '@/lib/longform/parse';
import LongformBody from '@/lib/longform/LongformBody';
import ShareButton from './ShareButton';
import TipButton from '@/components/tips/TipButton';
import ArticleOwnerActions from './ArticleOwnerActions';
import { formatDateLong } from '@/utils/dates';

interface PageProps {
  params: Promise<{ slug: string }>;
}

function profileHref(username: string | undefined, id: string): string {
  return `/profiles/${username ?? id}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    // generateMetadata resolves before the page's streaming boundary, so a
    // notFound() here can still send a real 404 status — unlike the same call
    // inside the (streamed) page body, which the root loading.tsx forces to a
    // 200 + auto-noindex "soft 404". Falls back to that safe behavior if
    // metadata itself streams.
    notFound();
  }

  const isIndexable = article.visibility === 'public';
  // Author-supplied cover wins; otherwise the generated share card. Non-public
  // articles get no image URL at all — the OG route 404s for them anyway, and
  // metadata for a private draft should leak nothing.
  const ogImage = article.coverImage
    ? article.coverImage
    : isIndexable
      ? `${SITE_URL}/api/og/article/${encodeURIComponent(article.slug)}`
      : undefined;

  return {
    title: article.title,
    description: article.excerpt,
    robots: isIndexable ? undefined : { index: false, follow: false },
    // Slugs are user-authored (title + random suffix) and duplicate-prone —
    // pin the canonical URL so near-duplicate titles don't split ranking.
    alternates: { canonical: `${SITE_URL}/articles/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.publishedAt,
      authors: [article.author.name],
      images: ogImage ? [ogImage] : undefined,
      url: `${SITE_URL}/articles/${article.slug}`,
    },
    twitter: {
      card: ogImage ? 'summary_large_image' : 'summary',
      title: article.title,
      description: article.excerpt,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  // ONE long-form pipeline: bip-kit typed blocks + reference renderer — the
  // same parse and renderer the studio blog uses. Typed blocks are the
  // security model for this user-authored markdown: no HTML passthrough
  // exists, so there is nothing to sanitize away.
  const { blocks, toc } = parseLongform(article.body);

  const isOwner = await isCurrentUserArticleAuthor(article.authorActorId);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    author: { '@type': 'Person', name: article.author.name },
    publisher: { '@type': 'Organization', name: APP_NAME, url: SITE_URL },
    url: `${SITE_URL}/articles/${article.slug}`,
    ...(article.coverImage ? { image: article.coverImage } : {}),
  };

  const authorHref = profileHref(article.author.username, article.author.id);
  const shareUrl = `${SITE_URL}/articles/${article.slug}`;

  return (
    <>
      {article.visibility === 'public' && <JsonLdScript data={jsonLd} />}
      <ReadingProgress />
      <div className="min-h-screen bg-surface-page pt-20 pb-24 text-fg-primary">
        <article className="mx-auto w-full max-w-[680px] px-5">
          <Link
            href={ROUTES.ARTICLES}
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {ARTICLE_COPY.reader.back}
          </Link>

          {article.coverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- cover may be an Openverse or user-pasted URL on any host; next/image would throw for hosts outside images.remotePatterns
            <img
              src={article.coverImage}
              alt=""
              className="mb-10 aspect-[2/1] w-full rounded-md border border-subtle object-cover"
            />
          )}

          <header className="mb-10">
            <h1 className="text-4xl font-semibold leading-[1.15] tracking-display text-fg-primary sm:text-5xl">
              {article.title}
            </h1>
            {article.excerpt && (
              <p className="mt-5 text-xl leading-relaxed text-fg-secondary">{article.excerpt}</p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-subtle py-4 text-sm text-fg-secondary">
              <Link
                href={authorHref}
                className="flex items-center gap-2.5 text-fg-primary transition-opacity hover:opacity-80"
              >
                {article.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns
                  <img
                    src={article.author.avatarUrl}
                    alt=""
                    className="h-9 w-9 rounded-full border border-subtle object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-subtle bg-surface-raised text-xs font-semibold text-fg-secondary">
                    {article.author.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="font-medium">{article.author.name}</span>
              </Link>
              <span aria-hidden className="text-fg-tertiary">
                ·
              </span>
              <time dateTime={article.publishedAt}>{formatDateLong(article.publishedAt)}</time>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {article.readingTime} min read
              </span>
              {article.visibility === 'private' && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-2 py-0.5 text-xs text-fg-secondary">
                  <Lock className="h-3.5 w-3.5" />
                  {ARTICLE_COPY.reader.privateNotice}
                </span>
              )}
              {article.visibility === 'followers' && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-raised px-2 py-0.5 text-xs text-fg-secondary">
                  <Users className="h-3.5 w-3.5" />
                  {ARTICLE_COPY.reader.followersNotice}
                </span>
              )}
            </div>
          </header>

          {/* On xl the sticky, scroll-spying TOC gets a rail to the right of
              the article column; it hides itself under 3 headings, so short
              pieces render a clean single column. */}
          <div className="xl:relative">
            <div className="[&>.bp-article>*:first-child]:mt-0">
              <LongformBody blocks={blocks} />
            </div>
            <aside className="hidden xl:absolute xl:left-full xl:top-0 xl:ml-12 xl:block xl:h-full xl:w-[240px]">
              <Toc items={toc} />
            </aside>
          </div>

          {/* Footer: author card + share + write-your-own CTA */}
          <footer className="mt-14 border-t border-subtle pt-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link
                href={authorHref}
                className="flex items-center gap-3 transition-opacity hover:opacity-80"
              >
                {article.author.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns
                  <img
                    src={article.author.avatarUrl}
                    alt=""
                    className="h-11 w-11 rounded-full border border-subtle object-cover"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-subtle bg-surface-raised text-sm font-semibold text-fg-secondary">
                    {article.author.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>
                  <span className="block text-xs text-fg-tertiary">Written by</span>
                  <span className="block font-semibold text-fg-primary">{article.author.name}</span>
                </span>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {article.author.username && (
                  <TipButton
                    username={article.author.username}
                    recipientName={article.author.name}
                  />
                )}
                {isOwner && <ArticleOwnerActions articleId={article.id} slug={article.slug} />}
                <ShareButton title={article.title} url={shareUrl} />
              </div>
            </div>

            <div className="mt-8 flex flex-col items-start gap-3 rounded-md border border-subtle bg-surface-raised/25 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-fg-secondary">
                Have something to say? Publishing on OrangeCat is free.
              </p>
              <Link
                href={ROUTES.ARTICLES_NEW}
                className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-accent-warm px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-warm-hover"
              >
                Write your own
              </Link>
            </div>
          </footer>
        </article>
      </div>
    </>
  );
}
