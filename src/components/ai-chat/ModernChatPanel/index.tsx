'use client';

/**
 * MODERN CHAT PANEL
 *
 * Modular chat component for Cat conversations.
 * `focus` variant is the default Cat hub experience (full-height, minimal chrome).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown } from 'lucide-react';
import { ChatScreen, useStickToBottom } from '@bitbaum/chatkit/react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { CAT_SEND_EVENT } from '@/lib/chat/cat-send-event';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

import {
  useChatMessages,
  useSuggestions,
  usePendingActionsManager,
  useCatQuota,
  useMemoryNotes,
} from './hooks';
import { ChatHeader, ChatInput, EmptyState, ErrorDisplay, MessageBubble } from './components';
import { MemoryNoteCard } from './components/MemoryNoteCard';
import { PendingActionsCard } from '../PendingActionsCard';
import { composeMessage, imagesOf, type ChatAttachment } from './attachments';
import type { ChatImage } from '@/services/cat/chat-images';
import type { CatAction } from './types';

interface ModernChatPanelProps {
  /**
   * If provided, this message is automatically sent as the user's first message
   * once chat history finishes loading and the conversation is empty.
   */
  initialMessage?: string;
  /** When true, shows an onboarding welcome in the empty state for first-time users. */
  isNewUser?: boolean;
  /** `focus` = full-height Cat hub (toolbar lives in parent). */
  variant?: 'default' | 'focus';
  selectedModel?: string;
  onModelSelect?: (model: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  /**
   * Fires after every send attempt (success, abort, or error). The hub uses
   * this to refresh its lifted quota meter so the chip ticks down without a
   * page reload. Composed alongside the internal post-send wiring.
   */
  onMessageSent?: () => void;
  /**
   * Active conversation to load/send to. Omitted/null → fresh new-chat draft:
   * nothing is loaded and a conversation is created lazily on the first send.
   */
  conversationId?: string | null;
  /** Fires after each send so the conversation rail can refresh title + order. */
  onConversationStarted?: () => void;
  /** Fires when the first send of a fresh draft created a conversation — adopt it. */
  onConversationCreated?: (id: string) => void;
  /** The conversation the first send creates is a temporary chat. */
  temporary?: boolean;
  /** Current page the user is on (global overlay) so Cat is page-aware. */
  pageContext?: import('@/config/cat-page-context').CatPageDescriptor | null;
  /**
   * Floats over the top of the conversation (focus variant): the hub's
   * toolbar. The words scroll under it and fade — nothing takes a strip of
   * the screen away from the reading.
   */
  header?: ReactNode;
  className?: string;
}

export function ModernChatPanel({
  initialMessage,
  isNewUser,
  variant = 'focus',
  selectedModel: selectedModelProp,
  onModelSelect,
  onLoadingChange,
  onMessageSent,
  conversationId,
  onConversationStarted,
  onConversationCreated,
  temporary,
  pageContext,
  header,
  className,
}: ModernChatPanelProps = {}) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [internalModel, setInternalModel] = useState('auto');
  // Remember the user's model choice (incl. custom ids) across reloads.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cat:model');
      if (saved) {
        setInternalModel(saved);
      }
    } catch {
      // localStorage unavailable — fall back to the in-memory default.
    }
  }, []);
  const persistModel = useCallback((m: string) => {
    setInternalModel(m);
    try {
      localStorage.setItem('cat:model', m);
    } catch {
      // ignore persistence failures
    }
  }, []);
  const selectedModel = selectedModelProp ?? internalModel;
  const setSelectedModel = onModelSelect ?? persistModel;
  const lastUserMessageRef = useRef<{ content: string; images: ChatImage[] } | null>(null);
  const initialMessageSentRef = useRef(false);
  const refreshPendingActionsRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const isFocus = variant === 'focus';

  const { quota, refresh: refreshQuota } = useCatQuota();
  const { memoryNotes, checkAfterSend, undoNote, dismissNote } = useMemoryNotes();

  const {
    messages,
    isLoading,
    isLoadingHistory,
    error,
    errorCode,
    messagesEndRef,
    sendMessage,
    stopGeneration,
    clearChat,
    setError,
    addSystemMessage,
    resolvePendingChip,
  } = useChatMessages({
    selectedModel,
    conversationId,
    temporary,
    onPendingResult: () => refreshPendingActionsRef.current?.(),
    onMessageSent: () => {
      refreshQuota();
      // New memories land a few seconds after the reply (detached extraction);
      // poll so they surface as an undoable "Cat noted" card, never silently.
      checkAfterSend();
      onMessageSent?.();
    },
    onConversationStarted,
    onConversationCreated,
    pageContext,
  });

  const { opener, chips, attachable, dismissOpener, isLoadingSuggestions } = useSuggestions();

  const { pendingActions, handleConfirmAction, handleRejectAction, refreshPendingActions } =
    usePendingActionsManager({
      onActionConfirmed: (action, outcome) => {
        // The handler's own words first ("set up for Annushka — send her the
        // link"), and the link itself: a completed handoff or claim used to
        // end in the card's description, with the one URL the user needed next
        // nowhere on screen (seen live 2026-09-10).
        const line = `✅ ${outcome.message ?? `Action completed: ${action.description}`}`;
        addSystemMessage(outcome.url ? `${line}\n\n[Open](${outcome.url})` : line);
        // The chip above the card was still saying "needs your confirmation".
        // The tool_call stream closed when the turn ended and the confirm route
        // emits no events, so nothing ever told it the answer had arrived.
        resolvePendingChip(action.id, { status: 'completed' });
      },
      onActionRejected: actionId => resolvePendingChip(actionId, { status: 'declined' }),
    });

  refreshPendingActionsRef.current = refreshPendingActions;

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  useEffect(() => {
    if (
      initialMessage &&
      !isLoadingHistory &&
      messages.length === 0 &&
      !isLoading &&
      !initialMessageSentRef.current
    ) {
      initialMessageSentRef.current = true;
      void sendMessage(initialMessage);
    }
  }, [initialMessage, isLoadingHistory, messages.length, isLoading, sendMessage]);

  const handleSend = useCallback(() => {
    const content = composeMessage(input, attachments);
    if (content) {
      const images = imagesOf(attachments);
      lastUserMessageRef.current = { content, images };
      setInput('');
      setAttachments([]);
      void sendMessage(content, images);
    }
  }, [input, attachments, sendMessage]);

  const handleRetry = useCallback(() => {
    if (lastUserMessageRef.current) {
      setError(null);
      void sendMessage(lastUserMessageRef.current.content, lastUserMessageRef.current.images);
    }
  }, [sendMessage, setError]);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, [setError]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      void sendMessage(suggestion);
    },
    [sendMessage]
  );

  // Words sent from beside the panel (lib/chat/cat-send-event) go through the
  // same send as a suggestion chip.
  useEffect(() => {
    const onSend = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text === 'string' && text.trim()) {
        void sendMessage(text);
      }
    };
    window.addEventListener(CAT_SEND_EVENT, onSend);
    return () => window.removeEventListener(CAT_SEND_EVENT, onSend);
  }, [sendMessage]);

  const handleActionClick = useCallback(
    (action: CatAction) => {
      if (action.type === 'create_entity') {
        const entityMeta = ENTITY_REGISTRY[action.entityType];
        if (entityMeta?.createPath) {
          const prefillParams = new URLSearchParams();
          Object.entries(action.prefill).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
              prefillParams.set(key, String(value));
            }
          });
          router.push(`${entityMeta.createPath}?${prefillParams.toString()}`);
        }
      } else if (action.type === 'update_entity' || action.type === 'publish_entity') {
        const entityMeta = ENTITY_REGISTRY[action.entityType];
        // Entities are edited via their create page in edit mode (?edit=<id>) —
        // EntityCreateEditPage reads it. There is no /{basePath}/{id}/edit route
        // for most types, so the old path 404'd for everything but causes/tasks.
        if (entityMeta?.createPath) {
          router.push(`${entityMeta.createPath}?edit=${action.entityId}`);
        }
      } else if (action.type === 'suggest_wallet') {
        const walletMeta = ENTITY_REGISTRY.wallet;
        const prefillParams = new URLSearchParams();
        Object.entries(action.prefill).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            prefillParams.set(key, String(value));
          }
        });
        router.push(`${walletMeta.basePath}?${prefillParams.toString()}`);
      }
    },
    [router]
  );

  // Follows new turns only while the reader is at the bottom, and stays
  // pinned through size changes — the floating composer growing, its height
  // measured after the first paint — with a way back down otherwise.
  const { scrollRef, endRef, following, onScroll, jumpToBottom } = useStickToBottom(
    [messages.length, isLoadingHistory],
    messages.length
  );
  const setEnd = useCallback(
    (el: HTMLDivElement | null) => {
      endRef.current = el;
      messagesEndRef.current = el;
    },
    [endRef, messagesEndRef]
  );

  const isEmpty = !isLoadingHistory && messages.length === 0;
  // Centred in the empty state (focus variant) from sm up; on a phone it
  // floats at the bottom as in a thread, where the thumb is, and the empty
  // state gathers above it (globals.css, .oc-chat-empty). Pinned below the
  // thread otherwise.
  const phone = useMediaQuery('(max-width: 639px)');
  const composerInline = isFocus && isEmpty && !phone;
  const composer = (
    <ChatInput
      value={input}
      onChange={setInput}
      onSend={handleSend}
      isLoading={isLoading}
      onStop={stopGeneration}
      variant={variant}
      placement={composerInline ? 'inline' : 'bottom'}
      hasMessages={messages.length > 0}
      onClearChat={clearChat}
      selectedModel={selectedModel}
      onModelSelect={setSelectedModel}
      attachments={attachments}
      onAttachmentsChange={setAttachments}
      attachable={attachable}
    />
  );

  const thread = (
    <div ref={scrollRef} className="oc-chat-scroll" onScroll={onScroll}>
      {isLoadingHistory ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-fg-secondary">Loading conversation…</p>
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          opener={opener}
          chips={chips}
          isLoadingSuggestions={isLoadingSuggestions}
          onSuggestionClick={handleSuggestionClick}
          onDismissOpener={dismissOpener}
          isNewUser={isNewUser}
          variant={variant}
          composer={composerInline ? composer : undefined}
        />
      ) : (
        <div className="oc-chat-thread">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isLast={i === messages.length - 1 && pendingActions.length === 0}
              onActionClick={handleActionClick}
              onQuickReply={handleSuggestionClick}
              variant={variant}
            />
          ))}

          {pendingActions.length > 0 && (
            <div className="space-y-3">
              {pendingActions.map(action => (
                <PendingActionsCard
                  key={action.id}
                  action={action}
                  onConfirm={handleConfirmAction}
                  onReject={handleRejectAction}
                />
              ))}
            </div>
          )}

          <MemoryNoteCard notes={memoryNotes} onUndo={undoNote} onDismiss={dismissNote} />

          <div ref={setEnd} />
        </div>
      )}
    </div>
  );
  const errorDisplay = error && (
    <ErrorDisplay
      error={error}
      code={errorCode}
      onRetry={handleRetry}
      onDismiss={handleDismissError}
    />
  );

  if (isFocus) {
    // The whole display is the conversation; the toolbar and the composer
    // float over it (chatkit's ChatScreen). While the chat is empty the
    // composer sits in the centred column instead, so the dock is hidden.
    return (
      <div className={cn('oc-chat-layout', className)}>
        <ChatScreen
          header={header}
          composer={
            <>
              {errorDisplay}
              {!composerInline && composer}
            </>
          }
          className={composerInline ? 'oc-chat-screen-empty' : undefined}
        >
          {thread}
          {!following && !isEmpty && (
            <button
              type="button"
              className="ck-jump"
              onClick={jumpToBottom}
              aria-label="Jump to the latest message"
              title="Jump to the latest message"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          )}
        </ChatScreen>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'oc-chat-layout min-h-[34rem] rounded-md border border-subtle',
        'h-[calc(100dvh_-_15.5rem)] sm:h-[calc(100dvh_-_13rem)]',
        className
      )}
    >
      <ChatHeader
        selectedModel={selectedModel}
        onModelSelect={setSelectedModel}
        isLoading={isLoading}
        hasMessages={messages.length > 0}
        onClearChat={clearChat}
        quota={quota}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {thread}
        {errorDisplay}
        {composer}
      </div>
    </div>
  );
}

export default ModernChatPanel;
