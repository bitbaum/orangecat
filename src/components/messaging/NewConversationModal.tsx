'use client';

import { logger } from '@/utils/logger';
import { API_ROUTES } from '@/config/api-routes';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Search, MessageSquare, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api/errorMessage';

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
}

export default function NewConversationModal({
  isOpen,
  onClose,
  onCreated,
  initialUserId,
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
    try {
      setLoading(true);
      setError(null);
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;
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
      setProfiles(arr);
    } catch (e) {
      interface ErrorWithName {
        name?: string;
      }
      const errorWithName = e as ErrorWithName;
      if (errorWithName.name === 'AbortError') {
        return;
      }
      setError(e instanceof Error ? e.message : 'Failed to load people');
    } finally {
      setLoading(false);
    }
  }, []);

  const startConversation = useCallback(
    async (profileId: string) => {
      try {
        setCreatingId(profileId);
        setError(null);

        // Use /api/messages/open which handles self / direct / group cases
        const res = await fetch(API_ROUTES.MESSAGES.OPEN, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ participantIds: [profileId] }),
        });

        const data = await res.json();

        // Handle wrapped response format from apiSuccess
        const conversationId = data.data?.conversationId || data.conversationId;

        if (!res.ok || !conversationId) {
          // This chain was a hand-rolled apiErrorMessage that got the first
          // link wrong: `data.error` is the envelope's `{ code, message }`
          // object, so it won the `||` and the thrown Error read
          // "[object Object]". The remaining links are this endpoint's extra
          // postgrest detail, kept as a fallback behind the shared reader.
          const errorMessage = apiErrorMessage(
            data,
            data.details || data.hint || 'Failed to create conversation'
          );
          logger.error('Failed to create conversation:', {
            status: res.status,
            error: data.error,
            details: data.details,
            code: data.code,
            hint: data.hint,
            responseData: data,
          });
          throw new Error(errorMessage);
        }
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
      fetchProfiles('');
      // Focus search input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
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
    <div
      className="fixed inset-0 z-modal bg-black/50 flex items-center justify-center p-0 md:p-4"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Full-screen below md: a centered card left the bottom search rows
          sharing screen space with the fixed mobile nav / Ask Cat FAB corner
          on short phones — a full-bleed sheet removes that shared corridor
          entirely instead of relying on winning a z-index fight every time. */}
      <div className="flex h-full w-full flex-col overflow-hidden bg-surface-page animate-in fade-in duration-200 md:h-auto md:w-full md:max-w-md md:zoom-in-95 md:rounded-md md:border md:border-subtle">
        {/* Header */}
        <div className="p-4 border-b border-subtle flex items-center justify-between">
          <h3 className="text-lg font-semibold text-fg-primary">New Message</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md p-2 transition-colors hover:bg-surface-raised hover:text-fg-primary"
          >
            <X className="w-5 h-5 text-fg-secondary" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-subtle">
          <div className="relative">
            <Search className="w-5 h-5 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => handleChange(e.target.value)}
              placeholder="Search by name or @username"
              className="w-full rounded-md border border-subtle bg-surface-raised py-3 pl-11 pr-4 text-sm text-fg-primary placeholder:text-fg-secondary transition-colors focus:bg-surface-page focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="border-b border-status-negative/20 bg-status-negative/10 px-4 py-3">
            <p className="text-sm text-status-negative">{error}</p>
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
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  aria-disabled={!!creatingId}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-surface-raised',
                    creatingId === p.id && 'opacity-60'
                  )}
                  onClick={() => {
                    if (!creatingId) {
                      startConversation(p.id);
                    }
                  }}
                  onKeyDown={e => {
                    if (creatingId) {
                      return;
                    }
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      startConversation(p.id);
                    }
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar_url is a free-form user URL (any host); next/image would throw for hosts outside images.remotePatterns */}
                  <img
                    src={p.avatar_url || '/default-avatar.svg'}
                    alt={p.name || p.username || 'User'}
                    className="h-11 w-11 rounded-md bg-surface-raised object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-fg-primary truncate">
                      {p.name || p.username || 'User'}
                    </div>
                    {/* Only when the handle adds information beyond the title above —
                        a profile with no name already shows its handle there, so
                        repeating "@handle" underneath is pure noise, worse on
                        narrow screens where both lines truncate. */}
                    {p.username && p.name && p.name !== p.username && (
                      <div className="text-sm text-fg-secondary truncate">@{p.username}</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    disabled={!!creatingId && creatingId !== p.id}
                    className="flex-shrink-0 bg-fg-primary text-fg-inverted hover:bg-fg-primary/90"
                    onClick={e => {
                      e.stopPropagation();
                      if (!creatingId) {
                        startConversation(p.id);
                      }
                    }}
                  >
                    {creatingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Message'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
