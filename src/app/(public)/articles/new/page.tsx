'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuthRedirects';
import { ROUTES } from '@/config/routes';
import Button from '@/components/ui/Button';
import { bodyWithAttribution, type ImportedArticle } from '@/services/articles/import-source';
import ArticleComposer, { type ArticlePrefill } from './ArticleComposer';

type Import =
  | { state: 'none' }
  | { state: 'loading' }
  | { state: 'ready'; prefill: ArticlePrefill }
  | { state: 'failed'; message: string };

/**
 * `?import=<fleet article JSON url>` seeds the composer with an article from a
 * sister product (BiasLens's "Post on OrangeCat"). The server proxy checks the
 * host; this only waits for the answer.
 */
function useImport(url: string | null): Import {
  const [value, setValue] = useState<Import>(url ? { state: 'loading' } : { state: 'none' });
  useEffect(() => {
    if (!url) {
      return;
    }
    let cancelled = false;
    fetch(`/api/articles/import?url=${encodeURIComponent(url)}`)
      .then(async response => {
        const payload = (await response.json()) as {
          success?: boolean;
          data?: ImportedArticle;
          error?: { message?: string };
        };
        if (cancelled) {
          return;
        }
        if (!payload.success || !payload.data) {
          setValue({
            state: 'failed',
            message: payload.error?.message ?? 'That article could not be brought over.',
          });
          return;
        }
        const article = payload.data;
        setValue({
          state: 'ready',
          prefill: {
            title: article.title,
            excerpt: article.excerpt,
            body: bodyWithAttribution(article),
            host: article.host,
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          setValue({ state: 'failed', message: 'That article could not be brought over.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return value;
}

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-subtle border-t-accent-warm" />
    </div>
  );
}

function NewArticle() {
  const { user, isLoading } = useRequireAuth();
  const params = useSearchParams();
  const importUrl = params.get('import');
  const imported = useImport(importUrl);

  if (isLoading || imported.state === 'loading') {
    return <Spinner />;
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-page px-6 text-center">
        <p className="text-fg-secondary">Sign in to write an article.</p>
        <Button href={`${ROUTES.AUTH}?mode=login`} variant="accent">
          Sign in
        </Button>
      </div>
    );
  }

  return (
    <>
      {imported.state === 'failed' && (
        <p
          role="alert"
          className="mx-auto w-full max-w-[720px] px-5 pt-8 text-sm text-status-negative"
        >
          {imported.message} You can still write it here.
        </p>
      )}
      <ArticleComposer
        key={`${user.id}:${importUrl ?? 'new'}`}
        user={{ id: user.id }}
        prefill={imported.state === 'ready' ? imported.prefill : undefined}
      />
    </>
  );
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewArticle />
    </Suspense>
  );
}
