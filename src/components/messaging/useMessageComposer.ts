'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { takeMessageDraft } from '@/features/messaging/lib/draft';
import { useAuth } from '@/hooks/useAuth';
import { useTypingIndicator } from '@/features/messaging/hooks/useTypingIndicator';
import { useMessagingActors } from '@/features/messaging/hooks/useMessagingActors';
import type { Message } from '@/features/messaging/types';
import { sendMessage } from './messageComposerSend';

interface UseMessageComposerParams {
  conversationId: string;
  onMessageSent: (message: Message) => void;
  onMessageFailed?: (tempId: string, errorMessage?: string) => void;
  onMessageConfirmed?: (tempId: string, realMessage: Message) => void;
}

export function useMessageComposer({
  conversationId,
  onMessageSent,
  onMessageFailed,
  onMessageConfirmed,
}: UseMessageComposerParams) {
  const { user, profile } = useAuth();
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // A draft left for this conversation ("Ask about this" on a listing): put it
  // in the box with the cursor at the end, for the user to finish and send.
  useEffect(() => {
    const draft = conversationId ? takeMessageDraft(conversationId) : null;
    if (draft) {
      setContent(draft);
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        el?.focus();
        el?.setSelectionRange(draft.length, draft.length);
      });
    }
  }, [conversationId]);

  const { actors, personalActor, groupActors } = useMessagingActors();
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);

  const selectedActor = selectedActorId
    ? actors.find(a => a.actor_id === selectedActorId)
    : personalActor;

  const showActorSelector = actors.length > 1;

  const { startTyping, stopTyping, typingText } = useTypingIndicator(conversationId, {
    enabled: !!conversationId && !!user?.id,
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await sendMessage({
        content,
        isSending,
        user,
        profile,
        conversationId,
        stopTyping,
        onMessageSent,
        onMessageFailed,
        onMessageConfirmed,
        selectedActor,
        setIsSending,
        setContent,
        textareaRef,
      });
    },
    [
      content,
      isSending,
      user,
      profile,
      conversationId,
      stopTyping,
      onMessageSent,
      onMessageFailed,
      onMessageConfirmed,
      selectedActor,
    ]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as unknown as React.FormEvent);
      }
    },
    [handleSubmit]
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setContent(e.target.value);
      if (e.target.value.trim()) {
        startTyping();
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    },
    [startTyping]
  );

  return {
    content,
    isSending,
    textareaRef,
    selectedActor,
    selectedActorId,
    setSelectedActorId,
    showActorSelector,
    personalActor,
    groupActors,
    typingText,
    handleSubmit,
    handleKeyDown,
    handleTextareaChange,
  };
}
