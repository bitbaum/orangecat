'use client';

import React, { useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useConversations } from '@/features/messaging/hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { API_ROUTES } from '@/config/api-routes';
import { ConversationListItem } from './ConversationListItem';

interface ConversationListProps {
  searchQuery: string;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  filterTab?: 'all' | 'unread';
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestSelectionMode?: () => void;
  refreshSignal?: number;
  /**
   * Trigger to open the new-conversation modal. Wired to the empty
   * state so users with zero conversations have an in-place CTA
   * instead of being told to find a button in the page header.
   */
  onStartNew?: () => void;
}

export default function ConversationList({
  searchQuery,
  selectedConversationId,
  onSelectConversation,
  filterTab = 'all',
  selectionMode = false,
  selectedIds,
  onToggleSelect,
  onRequestSelectionMode,
  refreshSignal,
  onStartNew,
}: ConversationListProps) {
  const { user } = useAuth();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPointerSelecting, setIsPointerSelecting] = useState(false);
  const [dragAction, setDragAction] = useState<'select' | 'deselect' | null>(null);
  const pressTimerRef = React.useRef<number | null>(null);
  const currentUserId = user?.id;

  const { conversations, loading, error, refresh, removeLocal } = useConversations(
    searchQuery,
    selectedConversationId
  );

  const handleDeleteOne = async (id: string) => {
    removeLocal([id]);
    try {
      const res = await fetch(API_ROUTES.MESSAGES.BULK_CONVERSATIONS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [id] }),
      });
      if (!res.ok) {
        toast.error('Could not delete conversation. Please try again.');
        await refresh();
      }
    } catch {
      toast.error('Could not delete conversation. Please try again.');
      await refresh();
    }
  };

  React.useEffect(() => {
    if (typeof refreshSignal !== 'number') {
      return;
    }
    refresh();
  }, [refreshSignal, refresh]);

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const toggleSelect = (id: string, desired?: 'select' | 'deselect') => {
    if (!onToggleSelect) {
      return;
    }
    const alreadySelected = selectedIds?.has(id);
    const shouldSelect = desired ? desired === 'select' : !alreadySelected;
    if (shouldSelect && !alreadySelected) {
      onToggleSelect(id);
    } else if (!shouldSelect && alreadySelected) {
      onToggleSelect(id);
    }
  };

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    conversationId: string,
    isSelected: boolean
  ) => {
    if (e.pointerType === 'touch') {
      clearPressTimer();
      pressTimerRef.current = window.setTimeout(() => {
        onRequestSelectionMode?.();
        toggleSelect(conversationId, isSelected ? 'deselect' : 'select');
        setIsPointerSelecting(true);
        setDragAction(isSelected ? 'deselect' : 'select');
      }, 350);
    }
    if (selectionMode) {
      e.preventDefault();
      setIsPointerSelecting(true);
      const action = isSelected ? 'deselect' : 'select';
      setDragAction(action);
      toggleSelect(conversationId, action);
    }
  };

  const handlePointerEnter = (conversationId: string) => {
    if (!isPointerSelecting || !dragAction) {
      return;
    }
    toggleSelect(conversationId, dragAction);
  };

  const handlePointerUp = () => {
    clearPressTimer();
    setIsPointerSelecting(false);
    setDragAction(null);
  };

  const conversationsArray = Array.isArray(conversations) ? conversations : [];

  const filteredConversations = conversationsArray.filter(conversation => {
    if (filterTab === 'unread') {
      return conversation.unread_count > 0;
    }
    if (!searchQuery) {
      return true;
    }
    const q = searchQuery.toLowerCase();
    if (conversation.title?.toLowerCase().includes(q)) {
      return true;
    }
    return conversation.participants.some(
      p => p.name?.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="flex items-center gap-3 p-3">
              <div className="h-10 w-10 rounded-md bg-fg-secondary/20"></div>
              <div className="flex-1">
                <div className="mb-2 h-4 rounded bg-fg-secondary/20"></div>
                <div className="h-3 w-3/4 rounded bg-fg-secondary/20"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-status-negative" />
        <p className="mb-3 text-sm text-status-negative">{error}</p>
        <button
          onClick={() => refresh()}
          className="inline-flex items-center gap-2 text-sm text-fg-primary hover:text-fg-secondary"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-subtle">
        {filteredConversations.length === 0 ? (
          <div className="p-10 text-center text-fg-secondary">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium">
              {searchQuery
                ? 'No conversations match your search'
                : filterTab === 'unread'
                  ? 'No unread conversations'
                  : 'No conversations yet'}
            </p>
            {!searchQuery && filterTab !== 'unread' && (
              <>
                <p className="mt-1 text-xs text-fg-tertiary">
                  Start a new conversation to get started.
                </p>
                {onStartNew && (
                  <button
                    type="button"
                    onClick={onStartNew}
                    className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-md bg-fg-primary px-4 py-2 text-sm font-medium text-fg-inverted transition-colors hover:bg-fg-primary/90"
                  >
                    Start New Conversation
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          filteredConversations.map(conversation => {
            const isSelected = selectedIds?.has(conversation.id) || false;
            return (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={isSelected}
                isActiveConversation={selectedConversationId === conversation.id}
                selectionMode={selectionMode}
                currentUserId={currentUserId}
                onPointerDown={e => handlePointerDown(e, conversation.id, isSelected)}
                onPointerEnter={() => handlePointerEnter(conversation.id)}
                onPointerUp={handlePointerUp}
                onClick={() => {
                  if (isPointerSelecting || selectionMode) {
                    return;
                  }
                  onSelectConversation(conversation.id);
                }}
                onToggleSelect={() => onToggleSelect?.(conversation.id)}
                onDeleteRequest={() => setConfirmDeleteId(conversation.id)}
              />
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) {
            handleDeleteOne(confirmDeleteId);
          }
          setConfirmDeleteId(null);
        }}
        title="Delete conversation?"
        description="This removes it for you. Other participants won't be affected."
        confirmLabel="Delete"
      />
    </>
  );
}
