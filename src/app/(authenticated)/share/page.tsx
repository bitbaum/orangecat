'use client';

import { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loading from '@/components/Loading';
import PostComposerMobile from '@/components/timeline/PostComposerMobile';
import { useRequireAuth } from '@/hooks/useAuthRedirects';
import { ROUTES } from '@/config/routes';
import { composeShareText, parseShareIntent } from '@/config/share';
import { TIMELINE_COPY } from '@/config/timeline';

/**
 * /share?url=&title=&text= — Share on OrangeCat.
 *
 * The composer, open and prefilled, the way x.com/intent/post opens X's.
 * Any page can link here: Loki's Thoughts, OrangeCat's own pages, a site
 * that is not ours. Signed out, useRequireAuth sends the reader to sign in
 * with this URL as `from`, so they come back to the same prefilled post.
 * Posting lands on the timeline where the post now is.
 */
function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated } = useRequireAuth();
  const intent = useMemo(
    () => (searchParams ? parseShareIntent(searchParams) : null),
    [searchParams]
  );

  if (isLoading) {
    return <Loading fullScreen contextual message="Opening the composer…" />;
  }
  if (!isAuthenticated || !user) {
    return <Loading fullScreen contextual message="Redirecting to login..." />;
  }
  if (!intent) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-fg-primary">Nothing to share.</p>
        <p className="text-sm text-fg-secondary">
          This page expects a link: <code className="text-fg-tertiary">/share?url=…</code>
        </p>
        <Link
          href={ROUTES.TIMELINE}
          className="text-sm text-accent-warm underline-offset-2 hover:underline"
        >
          Go to your timeline
        </Link>
      </div>
    );
  }

  const done = () => router.push(ROUTES.TIMELINE);
  return (
    <PostComposerMobile
      fullScreen
      isOpen
      autoFocus
      showProjectSelection
      initialContent={composeShareText(intent)}
      placeholder={TIMELINE_COPY.composePlaceholder}
      buttonText={TIMELINE_COPY.postButton}
      onClose={done}
      onSuccess={done}
    />
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<Loading fullScreen contextual message="Opening the composer…" />}>
      <ShareContent />
    </Suspense>
  );
}
