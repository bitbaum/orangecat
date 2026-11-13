/**
 * UpgradeNudge — gentle, honest prompt to run Cat on a more powerful model.
 *
 * Shown under an assistant reply only when the task wanted agentic capability
 * (discovery / creation / multi-step) but answered on a non-frontier model.
 * It's a suggestion at the moment of friction, not a nag: dismiss it and it
 * stays gone for the session (localStorage). Links straight to Settings → AI,
 * where the upgrade actually happens.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { ROUTES } from '@/config/routes';

const DISMISS_KEY = 'cat:upgradeNudge:dismissed';

function alreadyDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function UpgradeNudge() {
  const [dismissed, setDismissed] = useState<boolean>(alreadyDismissed);

  if (dismissed) {
    return null;
  }

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore — worst case it reappears next session
    }
  };

  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-subtle bg-surface-raised/40 px-3 py-2">
      <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-fg-secondary" />
      <div className="min-w-0 flex-1 text-xs text-fg-secondary">
        Tasks like this — discovery, matchmaking, multi-step work — are sharper on a frontier model.{' '}
        <Link
          href={ROUTES.SETTINGS_AI}
          className="inline-flex items-center gap-0.5 font-medium text-fg-primary underline decoration-fg-tertiary/50 underline-offset-2 hover:decoration-fg-primary"
        >
          Upgrade Cat
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss upgrade suggestion"
        className="flex-shrink-0 min-h-11 min-w-11 flex items-center justify-center rounded p-0.5 text-fg-tertiary hover:bg-surface-raised hover:text-fg-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default UpgradeNudge;
