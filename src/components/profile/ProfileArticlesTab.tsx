import Link from 'next/link';
import { PenLine } from 'lucide-react';
import ArticleList from '@/components/articles/ArticleList';
import { ROUTES } from '@/config/routes';
import { ARTICLE_COPY } from '@/config/articles';
import type { Article } from '@/services/articles/types';

/**
 * ProfileArticlesTab — the author's long-form articles on their profile. Data is
 * fetched server-side (session-aware: the owner also sees their non-public
 * articles) and passed down, so this is purely presentational. The byline is
 * hidden since the surrounding profile already names the author.
 */
export default function ProfileArticlesTab({
  articles,
  isOwnProfile,
}: {
  articles: Article[];
  isOwnProfile?: boolean;
}) {
  if (articles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 sm:px-4">
        <div className="rounded-lg border border-subtle bg-surface-raised/30 px-6 py-16 text-center">
          <p className="text-fg-secondary">
            {isOwnProfile ? ARTICLE_COPY.index.empty : 'No articles published yet.'}
          </p>
          {isOwnProfile && (
            <Link
              href={ROUTES.ARTICLES_NEW}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-fg-primary underline underline-offset-4 hover:text-fg-secondary"
            >
              <PenLine className="h-4 w-4" />
              {ARTICLE_COPY.index.write}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-0 sm:px-4">
      {isOwnProfile && (
        <div className="mb-2 flex justify-end">
          <Link
            href={ROUTES.ARTICLES_NEW}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-warm px-3.5 py-2 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-warm-hover"
          >
            <PenLine className="h-4 w-4" />
            {ARTICLE_COPY.index.write}
          </Link>
        </div>
      )}
      <ArticleList articles={articles} showAuthor={false} />
    </div>
  );
}
