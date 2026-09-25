/**
 * Cat — conversational AI entry (chat-first)
 *
 * A full-height chat surface. Everything about configuring Cat lives on the
 * Cat settings page; old `?tab=context|controls` links are forwarded there.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { ModernChatPanel } from '@/components/ai-chat/ModernChatPanel/index';
import { useCatQuota } from '@/components/ai-chat/ModernChatPanel/hooks/useCatQuota';
import { CatChatToolbar } from '@/components/ai-chat/CatChatToolbar';
import { CAT_HUB_TAB_HREFS } from '@/config/cat-hub';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';
import { useConversations } from '@/components/ai-chat/ModernChatPanel/hooks/useConversations';
import { ConversationRail } from '@/components/ai-chat/ModernChatPanel/components/ConversationRail';

export default function CatHubPage() {
  const { user, isLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const oldTab = searchParams?.get('tab');
  const forwardTo =
    oldTab === 'context' || oldTab === 'controls' ? CAT_HUB_TAB_HREFS[oldTab] : null;
  // Owned here, not in the rail: the toolbar renders the trigger (see
  // CatChatToolbar), so both halves read the same state.
  const [railOpen, setRailOpen] = useState(false);
  const { quota, refresh: refreshQuota } = useCatQuota();
  const {
    conversations,
    activeId,
    isLoading: isLoadingConversations,
    refresh: refreshConversations,
    selectConversation,
    newConversation,
    adoptConversation,
    deleteConversation,
  } = useConversations();

  useEffect(() => {
    if (forwardTo) {
      router.replace(forwardTo);
    }
  }, [forwardTo, router]);

  if (isLoading || forwardTo) {
    return <Loading fullScreen message="Loading..." />;
  }

  if (!user) {
    return null;
  }

  const initialMessage = searchParams?.get('q') || undefined;
  const isNewUser = searchParams?.get('welcome') === 'true';

  return (
    // Viewport-lock the chat to the region below the fixed header (the mobile
    // bottom nav is hidden on this route — see getRouteChrome). This bounds the
    // column to an absolute height, so a growing textarea scrolls the thread
    // instead of pushing the composer off-screen. `h-full` collapsed to content
    // height because the AppShell chain is min-h-screen (no bounded ancestor).
    <div className={`relative flex min-h-0 ${APP_CONTENT_HEIGHT_CLASS}`}>
      <ConversationRail
        conversations={conversations}
        activeId={activeId}
        isLoading={isLoadingConversations}
        onSelect={selectConversation}
        onNew={newConversation}
        onDelete={deleteConversation}
        mobileOpen={railOpen}
        onMobileOpenChange={setRailOpen}
      />
      <div className="oc-chat-layout min-h-0 min-w-0 flex-1">
        <CatChatToolbar quota={quota} onOpenConversations={() => setRailOpen(true)} />
        <ModernChatPanel
          variant="focus"
          conversationId={activeId}
          onConversationCreated={adoptConversation}
          onConversationStarted={refreshConversations}
          initialMessage={initialMessage}
          isNewUser={isNewUser}
          onMessageSent={refreshQuota}
          className="min-h-0 flex-1"
        />
      </div>
    </div>
  );
}
