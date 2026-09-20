/**
 * Cat — conversational AI entry (chat-first)
 *
 * Default view is a full-height chat surface. Context and controls are
 * secondary panels via ?tab=, not competing hub chrome.
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { ModernChatPanel } from '@/components/ai-chat/ModernChatPanel/index';
import { useCatQuota } from '@/components/ai-chat/ModernChatPanel/hooks/useCatQuota';
import { CatChatToolbar } from '@/components/ai-chat/CatChatToolbar';
import { CatSecondaryPanel } from '@/components/ai-chat/CatSecondaryPanel';
import { isCatHubTab, type CatHubTab } from '@/config/cat-hub';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';
import { useConversations } from '@/components/ai-chat/ModernChatPanel/hooks/useConversations';
import { ConversationRail } from '@/components/ai-chat/ModernChatPanel/components/ConversationRail';

export default function CatHubPage() {
  const { user, isLoading } = useRequireAuth();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<CatHubTab>('chat');
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
    const tab = searchParams?.get('tab');
    if (isCatHubTab(tab)) {
      setActiveTab(tab);
    } else {
      setActiveTab('chat');
    }
  }, [searchParams]);

  if (isLoading) {
    return <Loading fullScreen message="Loading..." />;
  }

  if (!user) {
    return null;
  }

  const initialMessage = searchParams?.get('q') || undefined;
  const isNewUser = searchParams?.get('welcome') === 'true';

  if (activeTab !== 'chat') {
    return <CatSecondaryPanel tab={activeTab} />;
  }

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
        <CatChatToolbar
          activePanel="chat"
          quota={quota}
          onOpenConversations={() => setRailOpen(true)}
        />
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
