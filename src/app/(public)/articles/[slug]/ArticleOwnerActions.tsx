'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Loader2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { ARTICLE_COPY } from '@/config/articles';
import { deleteArticle } from '@/services/articles/update';

/**
 * Owner-only edit/delete controls on the article reader. Delete uses an inline
 * two-step confirm (no jarring native dialog). Server gates visibility to the
 * author; the delete mutation is independently RLS-protected.
 */
export default function ArticleOwnerActions({
  articleId,
  slug,
}: {
  articleId: string;
  slug: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteArticle(articleId);
    if (!result.success) {
      setError(result.error);
      setDeleting(false);
      setConfirming(false);
      return;
    }
    router.push(ROUTES.ARTICLES);
    router.refresh();
  }

  const linkClass =
    'inline-flex items-center gap-1.5 rounded-md border border-default px-3 py-1.5 text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={ROUTES.ARTICLE_EDIT(slug)} className={linkClass}>
        <Pencil className="h-4 w-4" />
        {ARTICLE_COPY.reader.edit}
      </Link>

      {confirming ? (
        <span className="inline-flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-status-negative px-3 py-1.5 text-sm font-semibold text-fg-inverted transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? ARTICLE_COPY.reader.deleting : 'Confirm delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="text-sm text-fg-secondary hover:text-fg-primary"
          >
            {ARTICLE_COPY.new.cancel}
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={linkClass}
          title={ARTICLE_COPY.reader.deleteConfirm}
        >
          <Trash2 className="h-4 w-4" />
          {ARTICLE_COPY.reader.delete}
        </button>
      )}

      {error && <span className="text-sm text-status-negative">{error}</span>}
    </div>
  );
}
