'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import MessagePanel from '@/components/messaging/MessagePanel';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { API_ROUTES } from '@/config/api-routes';
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
  const { isLoading, isAuthenticated } = useRequireAuth();

  useEffect(() => {
    if (!isAuthenticated || !toUserId || idFromUrl) {
      return;
    }
    let cancelled = false;
    fetch(API_ROUTES.MESSAGES.OPEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ participantIds: [toUserId] }),
    })
      .then(async res => {
        const json = await res.json().catch(() => ({}));
        const conversationId = json?.data?.conversationId as string | undefined;
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
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, toUserId, idFromUrl, router, aboutTitle, aboutPath]);

  const id = idFromUrl || openedId;

  // Show loading while auth is being checked
  if (isLoading) {
    return <Loading fullScreen contextual message="Loading messages..." />;
  }

  // useRequireAuth will redirect if not authenticated
  if (!isAuthenticated) {
    return <Loading fullScreen contextual message="Redirecting to login..." />;
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
