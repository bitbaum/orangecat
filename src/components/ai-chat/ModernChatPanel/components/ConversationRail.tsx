'use client';

/**
 * CONVERSATION RAIL — Grok/ChatGPT-style left list of Cat conversations.
 *
 * Desktop (md+): an always-visible fixed-width column.
 * Mobile: a slide-over drawer. The TRIGGER is not here — it lives in the chat
 * toolbar as an ordinary flex child, so the caller owns `open` state.
 *
 * It used to be `absolute left-2 top-2 z-20`, floating over the top-left of
 * the chat column — which is exactly where the toolbar row is. On phones the
 * toolbar's left slot is hidden, so the quota chip became the first flex child
 * and landed under the button: "9 of 10 left" rendered as "f 10 left", with
 * the whole right half of the toolbar empty. An absolutely-positioned control
 * over a flex row it isn't part of cannot be laid out around; it has to join
 * the row.
 */

import { cn } from '@/lib/utils';
import { Plus, MessageSquare, Trash2, X } from 'lucide-react';
import { readableTitle } from '@/lib/chat/attachment-tags';
import type { ConversationSummary } from '../hooks/useConversations';

interface ConversationRailProps {
  conversations: ConversationSummary[];
  /** null = fresh new-chat draft (the default landing state). */
  activeId: string | null;
  /** True while the initial conversation list is loading — show placeholders, not "empty". */
  isLoading?: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

interface ConversationRailShellProps extends ConversationRailProps {
  /** Mobile drawer state — owned by the caller, which also renders the trigger. */
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function railTitle(c: ConversationSummary): string {
  return readableTitle(c.title ?? '') || 'New chat';
}

function RailBody({
  conversations,
  activeId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
}: ConversationRailProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-2">
        <button
          type="button"
          onClick={onNew}
          className={cn(
            'flex w-full items-center gap-2 rounded-lg border border-subtle px-3 py-2 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised',
            // Draft state (no active conversation) = "New chat" is where you are.
            activeId === null ? 'bg-surface-raised' : 'bg-surface-base'
          )}
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          // Skeleton rows while the list resolves — never flash "no conversations".
          <div className="space-y-1.5 px-1 py-1" aria-hidden>
            {[0, 1, 2].map(i => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-surface-raised/60" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          // One quiet line. It used to carry its own "Start a chat" button
          // directly under "New chat" — two buttons for one action, and the
          // chat itself is already open beside it.
          <p className="px-3 py-4 text-xs text-fg-tertiary">Your chats will appear here.</p>
        ) : (
          conversations.map(c => {
            const isActive = c.id === activeId;
            return (
              <div
                key={c.id}
                className={cn(
                  'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-surface-raised text-fg-primary'
                    : 'text-fg-secondary hover:bg-surface-raised/60'
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0 opacity-70" />
                  <span className="truncate">{railTitle(c)}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(c.id)}
                  className="flex-shrink-0 rounded p-2 text-fg-tertiary opacity-100 transition-opacity hover:text-status-negative md:opacity-0 md:group-hover:opacity-100"
                  aria-label={`Delete ${railTitle(c)}`}
                  title="Delete conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}

export function ConversationRail({
  mobileOpen,
  onMobileOpenChange,
  ...props
}: ConversationRailShellProps) {
  const setMobileOpen = onMobileOpenChange;

  return (
    <>
      {/* Desktop column */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-subtle bg-surface-page md:flex md:flex-col">
        <RailBody {...props} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80vw] flex-col border-r border-subtle bg-surface-page shadow-xl">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-fg-primary">Chats</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-secondary hover:bg-surface-raised"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <RailBody
                {...props}
                onSelect={id => {
                  props.onSelect(id);
                  setMobileOpen(false);
                }}
                onNew={() => {
                  props.onNew();
                  setMobileOpen(false);
                }}
              />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
