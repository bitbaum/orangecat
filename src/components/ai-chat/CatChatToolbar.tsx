'use client';

/**
 * The Cat's own controls in chatkit's ChatApp header. ChatApp draws the rest
 * of the row — Chats, the chat's title, New chat, and "…" with Temporary
 * chat, Rename and Delete — so these are only what is OrangeCat's:
 *
 *   start — Home, on phones, where the app header steps aside for the chat
 *           (getRouteChrome().immersiveChat) and this is the way back
 *   end   — the quota chip when it matters, Loki (one of the Cat's hands,
 *           visible where you ask), and ONE way into Cat settings
 *
 * Every control is ChatApp's own frosted 44px pill (`ck-glass`), so the row
 * reads as one header, not two toolbars stacked.
 */

import Link from 'next/link';
import { House, Settings2 } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { LokiChip } from './LokiChip';
import { QuotaMeter, isQuotaWorthShowing } from './ModernChatPanel/components/QuotaMeter';
import type { CatQuota } from './ModernChatPanel/hooks/useCatQuota';

export function CatHeaderStart() {
  return (
    <Link
      href={ROUTES.DASHBOARD.HOME}
      className="ck-glass ck-app-icon md:!hidden"
      aria-label="Home"
      title="Home"
    >
      <House className="h-4 w-4" />
    </Link>
  );
}

export function CatHeaderEnd({ quota = null }: { quota?: CatQuota | null }) {
  return (
    <div className="oc-chat-header-end">
      {/* min-w-0: the chip truncates rather than push the title out. */}
      {isQuotaWorthShowing(quota) && <QuotaMeter quota={quota} className="min-w-0" />}
      <div className="hidden sm:block">
        <LokiChip />
      </div>
      <Link
        href={ROUTES.DASHBOARD.CAT_SETTINGS}
        className="ck-glass ck-app-icon"
        aria-label="Cat settings"
        title="Cat settings"
      >
        <Settings2 className="h-4 w-4" />
      </Link>
    </div>
  );
}
