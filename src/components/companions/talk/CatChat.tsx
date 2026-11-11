'use client';

/**
 * The Cat, as a row in the bots list: the one bot here that acts on
 * OrangeCat (its pending actions, its approvals, its things). The same
 * panel as /dashboard/cat, with the list's back button in its header, so a
 * person who wants something done never has to know a second page.
 */

import { ChevronLeft } from 'lucide-react';
import { COMPANION_COPY } from '@/config/companions';
import { ModernChatPanel } from '@/components/ai-chat/ModernChatPanel/index';

export function CatChat({ onBack }: { onBack: () => void }) {
  return (
    <ModernChatPanel
      className="min-h-0 min-w-0 flex-1"
      headerStart={
        <button
          type="button"
          className="ck-glass lg:hidden"
          aria-label={COMPANION_COPY.talk.back}
          onClick={onBack}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      }
    />
  );
}
