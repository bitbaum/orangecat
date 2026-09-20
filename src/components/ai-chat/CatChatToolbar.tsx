'use client';

/**
 * Minimal toolbar for the Cat chat focus layout.
 * Context and controls live here instead of competing hub tabs/headers.
 */

import Link from 'next/link';
import { FolderOpen, PanelLeft, Settings2 } from 'lucide-react';
import { CAT_AGENT, CAT_HUB_COPY, CAT_HUB_TAB_HREFS, type CatHubTab } from '@/config/cat-hub';
import { cn } from '@/lib/utils';
import { QuotaMeter } from './ModernChatPanel/components/QuotaMeter';
import type { CatQuota } from './ModernChatPanel/hooks/useCatQuota';

interface CatChatToolbarProps {
  activePanel?: CatHubTab;
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
  activePanel = 'chat',
  className,
  quota = null,
  onOpenConversations,
}: CatChatToolbarProps) {
  const panelLink = (tab: Exclude<CatHubTab, 'chat'>) => {
    const href = CAT_HUB_TAB_HREFS[tab];
    const isActive = activePanel === tab;
    const Icon = tab === 'context' ? FolderOpen : Settings2;
    const label = tab === 'context' ? CAT_HUB_COPY.contextTitle : CAT_HUB_COPY.controlsTitle;

    return (
      <Link
        href={href}
        className={cn(
          'flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-sm transition-colors sm:min-w-0 sm:px-3',
          isActive
            ? 'bg-surface-raised text-fg-primary'
            : 'text-fg-secondary hover:bg-surface-raised/60 hover:text-fg-primary'
        )}
        aria-current={isActive ? 'page' : undefined}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  };

  return (
    <div className={cn('oc-chat-toolbar', className)}>
      {/* LEFT SLOT — never empty. The conversation trigger holds it on mobile
          and the "Cat · Private" label on >=sm, so `justify-between` always
          has two sides to push apart. With the label alone the slot vanished
          on phones, the quota chip became the first child and drifted left
          under the floating trigger, and the right half of the row sat empty. */}
      <div className="flex min-w-0 items-center gap-2">
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
        <div className="hidden min-w-0 items-center gap-2 sm:flex" title={CAT_AGENT.privacyBadge}>
          <p className="truncate text-sm font-medium text-fg-primary">{CAT_AGENT.name}</p>
          <p className="hidden truncate text-xs text-fg-secondary sm:inline">
            · {CAT_AGENT.privacyBadge}
          </p>
        </div>
      </div>

      {/* min-w-0 (not flex-shrink-0): the quota chip must be allowed to shrink
          and truncate. Pinned at its natural width it overflowed the toolbar
          on phones in the capped state and slid under the panel toggle. The
          two panel links stay fixed — they're the controls that must remain
          tappable. */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {activePanel === 'chat' && <QuotaMeter quota={quota} className="min-w-0" />}
        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
          {panelLink('context')}
          {panelLink('controls')}
        </div>
      </div>
    </div>
  );
}
