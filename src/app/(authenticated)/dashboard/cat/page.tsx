/**
 * Cat — conversational AI entry (chat-first)
 *
 * The whole screen is the chat: chatkit's ChatApp with the Cat's transport
 * (ModernChatPanel) — its chat list, New chat, Temporary chat, reopening the
 * chat you were in. Everything about configuring Cat lives on the Cat
 * settings page; old `?tab=context|controls` links are forwarded there.
 */

'use client';

import { useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { ModernChatPanel } from '@/components/ai-chat/ModernChatPanel/index';
import { useCatQuota } from '@/components/ai-chat/ModernChatPanel/hooks/useCatQuota';
import { CatHeaderEnd, CatHeaderStart } from '@/components/ai-chat/CatChatToolbar';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { CAT_QUERY_PARAM } from '@/config/cat-door';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';

export default function CatHubPage() {
  const { user, isLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const oldTab = searchParams?.get('tab');
  const forwardTo =
    oldTab === 'context' || oldTab === 'controls' ? CAT_HUB_TAB_HREFS[oldTab] : null;
  const { quota, refresh: refreshQuota } = useCatQuota();

  useEffect(() => {
    if (forwardTo) {
      router.replace(forwardTo);
    }
  }, [forwardTo, router]);

  // The words came in the link once; a reload must not send them again.
  const dropQuery = useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete(CAT_QUERY_PARAM);
    window.history.replaceState(window.history.state, '', url);
  }, []);

  if (isLoading || forwardTo) {
    return <Loading fullScreen message="Loading..." />;
  }

  if (!user) {
    return null;
  }

  return (
    // Viewport-locked to the region below the fixed header (the mobile bottom
    // nav is hidden on this route — see getRouteChrome), so the composer
    // stays above the keyboard and the thread scrolls under it.
    <div className={`relative flex min-h-0 ${APP_CONTENT_HEIGHT_CLASS}`}>
      <ModernChatPanel
        className="min-h-0 min-w-0 flex-1"
        headerStart={<CatHeaderStart />}
        headerEnd={<CatHeaderEnd quota={quota} />}
        initialMessage={searchParams?.get(CAT_QUERY_PARAM) || undefined}
        onInitialMessageSent={dropQuery}
        isNewUser={searchParams?.get('welcome') === 'true'}
        onTurnSettled={refreshQuota}
      />
    </div>
  );
}
