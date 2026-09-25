'use client';

/**
 * Minimal toolbar for the Cat chat: the conversations trigger (phones), the
 * quota chip when it matters, and ONE way into Cat settings — which replaced
 * the separate Context and Controls tabs.
 */

import Link from 'next/link';
import { PanelLeft, Settings2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { QuotaMeter, isQuotaWorthShowing } from './ModernChatPanel/components/QuotaMeter';
import type { CatQuota } from './ModernChatPanel/hooks/useCatQuota';

interface CatChatToolbarProps {
  className?: string;
  /** Daily-cap meter; rendered on the chat panel only. */
  quota?: CatQuota | null;
  /**
   * Opens the conversation rail on mobile. The rail used to float this button
   * over this row, which covered the quota chip — it belongs IN the row.
   */
  onOpenConversations?: () => void;
}

export function CatChatToolbar({
  className,
  quota = null,
  onOpenConversations,
}: CatChatToolbarProps) {
  return (
    <div className={cn('oc-chat-toolbar', className)}>
      {/* Left: the conversation trigger, phones only (the rail is always
          visible from md). It used to share the row with a "Cat · Saved ·
          clear anytime" label that told the user nothing they could act on. */}
      {onOpenConversations && (
        <button
          type="button"
          onClick={onOpenConversations}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary md:hidden"
          aria-label="Show conversations"
          title="Show conversations"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      )}

      {/* min-w-0 (not flex-shrink-0): the quota chip must be allowed to shrink
          and truncate. Pinned at its natural width it overflowed the toolbar
          on phones in the capped state and slid under the panel toggle. The
          two panel links stay fixed — they're the controls that must remain
          tappable. */}
      <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
        {isQuotaWorthShowing(quota) && <QuotaMeter quota={quota} className="min-w-0" />}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          <Link
            href={ROUTES.DASHBOARD.CAT_SETTINGS}
            className="flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm text-fg-secondary transition-colors hover:bg-surface-raised/60 hover:text-fg-primary sm:min-w-0 sm:px-3"
            aria-label="Cat settings"
          >
            <Settings2 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
