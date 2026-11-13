import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, Lock, Users } from 'lucide-react';
import { getArticleBySlug, isCurrentUserArticleAuthor } from '@/services/articles/get-article';
import { ARTICLE_COPY, deriveExcerpt } from '@/config/articles';
import { ROUTES } from '@/config/routes';
import { JsonLdScript } from '@/lib/seo/structured-data';
import { APP_NAME, SITE_URL } from '@/config/brand';
import { Toc, ReadingProgress } from '@bitbaum/bip-kit/react';
import '@bitbaum/bip-kit/styles.css';
import '@/lib/longform/longform.css';
import { parseLongform } from '@/lib/longform/parse';
import LongformBody from '@/lib/longform/LongformBody';
import { ShareRow } from '@/components/sharing/ShareRow';
import { shareIntentUrl } from '@/config/share';
import { getTipReceiveInfo } from '@/domain/tips/tip-service';
import { createServerClient } from '@/lib/supabase/server';
import TipButton from '@/components/tips/TipButton';
import ArticleOwnerActions from './ArticleOwnerActions';
import ArticleDiscussion from './ArticleDiscussion';
import { FormattedDate } from '@/components/ui/FormattedDate';

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
  const canonical = `${SITE_URL}/articles/${article.slug}`;
  if (!isIndexable) {
    // A followers-only or private article: its words never go into a tag that
    // travels with the link. An unfurler fetches signed out and gets a 404
    // anyway; this keeps the author's own session from leaking them either.
    return {
      title: `Article on ${APP_NAME}`,
      robots: { index: false, follow: false },
    };
  }

  // Author-supplied cover wins; otherwise the generated share card.
  const ogImage = article.coverImage
    ? article.coverImage
    : `${SITE_URL}/api/og/article/${encodeURIComponent(article.slug)}`;

  return {
    title: article.title,
    description: article.excerpt,
    // Slugs are user-authored (title + random suffix) and duplicate-prone —
    // pin the canonical URL so near-duplicate titles don't split ranking.
    alternates: { canonical },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      siteName: APP_NAME,
      publishedTime: article.publishedAt,
      authors: [article.author.name],
      images: [ogImage],
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: article.excerpt,
      images: [ogImage],
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

  const isOwner = await isCurrentUserArticleAuthor(article.authorProfileId);

  // Offer Tip only to an author who can receive it. Asked inside the dialog,
  // the answer came after the dialog had promised "straight to their wallet".
  const canTip = article.author.username
    ? ((
        await getTipReceiveInfo(await createServerClient(), article.author.username, {
          notifyDeadEnd: false,
        }).catch(() => null)
      )?.canReceive ?? false)
    : false;

  // An excerpt the author did not write is the opening paragraph again; shown
  // above the body it reads as a duplicate. Feeds and metadata still use it.
  const showExcerpt = !!article.excerpt && article.excerpt !== deriveExcerpt(article.body);

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
            <h1 className="font-heading text-4xl font-semibold leading-[1.15] tracking-display text-fg-primary sm:text-5xl">
              {article.title}
            </h1>
            {showExcerpt && (
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
              <time dateTime={article.publishedAt}>
                <FormattedDate value={article.publishedAt} mode="long" />
              </time>
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
            <div className="[&_.bp-article]:px-0 [&>.bp-article>*:first-child]:mt-0">
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
                {canTip && article.author.username && (
                  <TipButton
                    username={article.author.username}
                    recipientName={article.author.name}
                  />
                )}
                {isOwner && <ArticleOwnerActions articleId={article.id} slug={article.slug} />}
              </div>
            </div>

            <ShareRow
              className="mt-6"
              labels={{ landmark: 'Share this article' }}
              url={shareUrl}
              title={article.title}
              summary={article.excerpt}
              audience={article.visibility === 'public' ? 'public' : 'restricted'}
              crossPost={{
                label: `Post on ${APP_NAME}`,
                href: shareIntentUrl(SITE_URL, { url: shareUrl, title: article.title }),
                newTab: false,
              }}
            />

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

          {article.visibility === 'public' && (
            <ArticleDiscussion
              articleId={article.id}
              authorName={article.author.name}
              articlePath={ROUTES.ARTICLE(article.slug)}
            />
          )}
        </article>
      </div>
    </>
  );
}
