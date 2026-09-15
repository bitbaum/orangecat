import Link from 'next/link';
import { Clock } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import type { Article } from '@/services/articles/types';
import { APP_LOCALE } from '@/utils/locale';

/** Shared presentational list of article cards — used by the /articles index and
 *  the profile Articles tab so the card markup lives in exactly one place. */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(APP_LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ArticleList({
  articles,
  showAuthor = true,
}: {
  articles: Article[];
  /** Hide the byline where the surrounding context already names the author
   *  (e.g. the author's own profile tab). */
  showAuthor?: boolean;
}) {
  return (
    <ul className="divide-y divide-subtle">
      {articles.map(article => (
        <li key={article.id}>
          <Link
            href={ROUTES.ARTICLE(article.slug)}
            className="group flex gap-4 py-6 transition-opacity hover:opacity-90"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold leading-snug text-fg-primary group-hover:text-accent-warm">
                {article.title}
              </h2>
              {article.excerpt && (
                <p className="mt-1.5 line-clamp-2 text-fg-secondary">{article.excerpt}</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-sm text-fg-tertiary">
                {showAuthor && (
                  <>
                    <span className="font-medium text-fg-secondary">{article.author.name}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {article.readingTime} min
                </span>
              </div>
            </div>
            {article.coverImage && (
              // eslint-disable-next-line @next/next/no-img-element -- cover may be an Openverse or user-pasted URL on any host; next/image would throw for hosts outside images.remotePatterns
              <img
                src={article.coverImage}
                alt=""
                className="h-20 w-28 flex-shrink-0 rounded-lg border border-subtle object-cover"
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
