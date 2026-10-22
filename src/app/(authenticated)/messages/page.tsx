'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import MessagePanel from '@/components/messaging/MessagePanel';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import { openConversationFor } from '@/features/messaging/open-conversation.client';
import { ROUTES } from '@/config/routes';
import { inquiryDraft, stashMessageDraft } from '@/features/messaging/lib/draft';

function MessagesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idFromUrl = searchParams?.get('id') || searchParams?.get('c') || undefined;
  const toUserId = searchParams?.get('to') || undefined;
  // "Ask about this" on a listing: its title and path, turned into a draft.
  const aboutTitle = searchParams?.get('about') || undefined;
  const aboutPath = searchParams?.get('ref') || undefined;
  const [openedId, setOpenedId] = useState<string | undefined>(undefined);
  const [opening, setOpening] = useState(Boolean(toUserId && !idFromUrl));
  const [openError, setOpenError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { isLoading, isAuthenticated } = useRequireAuth();

  useEffect(() => {
    if (!toUserId || idFromUrl) {
      setOpening(false);
      setOpenError(null);
      setOpenedId(undefined);
      return;
    }
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setOpening(true);
    setOpenError(null);
    openConversationFor([toUserId], controller.signal)
      .then(conversationId => {
        if (!cancelled && conversationId) {
          if (aboutTitle) {
            // Only a same-site path becomes a link; anything else is ignored.
            const path = aboutPath?.startsWith('/') && !aboutPath.startsWith('//') ? aboutPath : '';
            stashMessageDraft(
              conversationId,
              inquiryDraft(aboutTitle.slice(0, 120), `${window.location.origin}${path}`)
            );
          }
          setOpenedId(conversationId);
          router.replace(ROUTES.MESSAGES_WITH_CONVERSATION(conversationId));
        }
      })
      .catch(error => {
        if (!cancelled) {
          setOpenError(error instanceof Error ? error.message : 'Could not open the conversation.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setOpening(false);
        }
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isAuthenticated, toUserId, idFromUrl, router, aboutTitle, aboutPath, attempt]);

  const id = idFromUrl || openedId;

  // Show loading while auth is being checked
  if (isLoading) {
    return <Loading fullScreen contextual message="Loading messages..." />;
  }

  // useRequireAuth will redirect if not authenticated
  if (!isAuthenticated) {
    return <Loading fullScreen contextual message="Redirecting to login..." />;
  }

  if (opening) {
    return <Loading fullScreen contextual message="Opening conversation…" />;
  }

  if (openError) {
    return (
      <div className="oc-page oc-interface mx-auto max-w-xl space-y-4 py-8">
        <h1 className="text-xl font-semibold">Couldn&apos;t open the conversation</h1>
        <p role="alert" className="text-sm text-fg-secondary">
          {openError}
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setAttempt(value => value + 1)}>Try again</Button>
          <Button variant="secondary" href={ROUTES.MESSAGES}>
            Back to messages
          </Button>
        </div>
      </div>
    );
  }

  return <MessagePanel isOpen fullPage initialConversationId={id} onClose={() => {}} />;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<Loading fullScreen contextual message="Loading messages..." />}>
      <MessagesContent />
    </Suspense>
  );
}
