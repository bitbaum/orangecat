'use client';

import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Search, MessageSquare, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import Input from '@/components/ui/Input';
import { openConversationFor } from '@/features/messaging/open-conversation.client';

type ProfileLite = {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
  bio?: string | null;
};

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
  /** Pre-fill with a specific user to message */
  initialUserId?: string;
  returnFocusRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onCreated,
  initialUserId,
  returnFocusRef,
}: NewConversationModalProps) {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProfiles = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const url = q
        ? `${API_ROUTES.PROFILES.BASE}?limit=20&search=${encodeURIComponent(q)}`
        : `${API_ROUTES.PROFILES.BASE}?limit=20`;
      const res = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
      if (!res.ok) {
        throw new Error('Failed to load people');
      }
      const data = await res.json();
      // API returns { success: true, data: [...] } but older responses nested under data.data
      const arr = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.data?.data)
          ? data.data.data
          : [];
      if (!controller.signal.aborted) {
        setProfiles(arr);
      }
    } catch (e) {
      if (controller.signal.aborted) {
        return;
      }
      interface ErrorWithName {
        name?: string;
      }
      const errorWithName = e as ErrorWithName;
      if (errorWithName.name === 'AbortError') {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load people');
    } finally {
      if (abortRef.current === controller && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  const startConversation = useCallback(
    async (profileId: string) => {
      try {
        setCreatingId(profileId);
        setError(null);

        const conversationId = await openConversationFor([profileId]);
        // Note: onCreated handler in parent already closes the modal via setShowNewModal(false)
        onCreated(conversationId);
      } catch (e) {
        logger.error('Error creating conversation:', e);
        setError(e instanceof Error ? e.message : 'Failed to create conversation');
      } finally {
        setCreatingId(null);
      }
    },
    [onCreated]
  );

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setProfiles([]);
      void fetchProfiles('');
    }
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      abortRef.current?.abort();
    };
  }, [isOpen, fetchProfiles]);

  // Handle initial user ID
  useEffect(() => {
    if (isOpen && initialUserId) {
      startConversation(initialUserId);
    }
  }, [isOpen, initialUserId, startConversation]);

  const handleChange = (val: string) => {
    setSearch(val);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => fetchProfiles(val), 300);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className="oc-interface left-0 top-0 z-modal flex h-[var(--app-viewport-height,100dvh)] max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0 md:left-1/2 md:top-1/2 md:h-auto md:max-h-[90vh] md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-md md:border"
        onOpenAutoFocus={event => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={event => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <div className="border-b border-subtle p-4 pr-16">
          <DialogTitle className="flex min-h-11 items-center text-lg">New message</DialogTitle>
        </div>
        <div className="border-b border-subtle p-4">
          <Input
            ref={inputRef}
            type="search"
            icon={Search}
            label="Find a person"
            aria-label="Find a person to message"
            value={search}
            onChange={event => handleChange(event.target.value)}
            placeholder="Name or @username"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="border-b border-status-negative/20 bg-status-negative/10 px-4 py-3">
            <p role="alert" className="text-sm text-status-negative">
              {error}
            </p>
          </div>
        )}

        {/* Results — fills the remaining sheet height below md so a long
            list scrolls within itself; safe-area padding keeps the last row
            clear of a device's home-indicator/gesture-bar inset. */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)] md:max-h-[50vh] md:flex-none md:pb-0">
          {loading && !creatingId ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-fg-tertiary" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="py-12 text-center">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-fg-tertiary dark:text-fg-secondary" />
              <p className="text-fg-secondary font-medium">
                {search ? 'No people found' : 'Search for someone to message'}
              </p>
              <p className="text-sm text-fg-tertiary mt-1">
                {search ? 'Try a different search term' : 'Type a name or username above'}
              </p>
            </div>
          ) : (
            <div className="py-2">
              {profiles.map(p => (
                <button
                  type="button"
                  key={p.id}
                  disabled={!!creatingId}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                    creatingId === p.id && 'opacity-60'
                  )}
                  onClick={() => startConversation(p.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns */}
                  <img
                    src={p.avatar_url || '/default-avatar.svg'}
                    alt={p.name || p.username || 'User'}
                    className="h-11 w-11 shrink-0 rounded-md bg-surface-raised object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium text-fg-primary">
                      {p.name || p.username || 'User'}
                    </span>
                    {/* Only when the handle adds information beyond the title above —
                        a profile with no name already shows its handle there, so
                        repeating "@handle" underneath is pure noise, worse on
                        narrow screens where both lines truncate. */}
                    {p.username && p.name && p.name !== p.username && (
                      <span className="block break-words text-sm text-fg-secondary">
                        @{p.username}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm text-fg-secondary">
                    {creatingId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Message'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
