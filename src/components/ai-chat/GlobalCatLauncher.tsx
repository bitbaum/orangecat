'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Cat, X, Maximize2 } from 'lucide-react';
import { ModernChatPanel } from '@/components/ai-chat/ModernChatPanel/index';
import { describePageForCat } from '@/config/cat-page-context';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

/**
 * Global Cat launcher — a floating button on every app page that opens Cat as a
 * slide-over, WITHOUT leaving the page. Because it lives on top of the current
 * page, it passes that page (and its entity, if any) to Cat, so "summarise this
 * project" / "who's asking about this?" work in context. The full history +
 * settings still live at the Cat hub, one click away via the expand button.
 *
 * Mounted once in AppShell; the parent decides when to render it (authed app
 * surfaces only, never the Cat hub itself).
 *
 * It YIELDS WHILE YOU READ. A 56px circle pinned to the right edge sits on top
 * of whatever body text is behind it, permanently — on the AI settings page it
 * covered the free-pool card's refresh control, the end of "resets in 15h 33m",
 * and the tail of a sentence about whose keys are whose. A floating control
 * that never moves is a floating control that eventually lands on something
 * that matters, so this one fades out while the page is scrolling and comes
 * back when it stops.
 */
export default function GlobalCatLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Keep the drawer's conversation across open/close within a session, so
  // reopening resumes the thread instead of starting cold.
  const [conversationId, setConversationId] = useState<string | null>(null);

  const page = describePageForCat(pathname);

  // Out of the way while the page is moving; back when it settles.
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    if (open) {
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 450);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Floating launcher — anchored clear of the bottom nav and the home
          indicator (.app-fab-anchor), and faded while the page scrolls. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask Cat about this page"
          className={cn(
            'app-fab-anchor fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-warm text-on-accent shadow-lg md:right-6',
            'transition-all duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-warm focus-visible:ring-offset-2',
            // Still focusable while faded: a keyboard user never triggers the
            // scroll state, and hiding it from them would be a regression.
            scrolling && 'pointer-events-none opacity-0 focus-visible:opacity-100'
          )}
          title="Ask Cat about this page"
        >
          <Cat className="h-6 w-6" />
        </button>
      )}

      {open && (
        <>
          {/* Backdrop (mobile emphasis; desktop keeps the page visible behind). */}
          <div
            className="fixed inset-0 z-40 bg-black/40 sm:bg-black/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <aside
            role="dialog"
            aria-label="Cat"
            className={cn(
              'fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface-page shadow-2xl',
              'sm:w-[420px] sm:border-l sm:border-default'
            )}
          >
            <header className="flex items-center justify-between border-b border-default px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent-warm/10 text-accent-warm">
                  <Cat className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg-primary">Cat</p>
                  {page?.label && (
                    <p className="truncate text-xs text-fg-tertiary">Looking at {page.label}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  href={ROUTES.DASHBOARD.CAT}
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                  title="Open the full Cat"
                  aria-label="Open the full Cat page"
                >
                  <Maximize2 className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                  aria-label="Close Cat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="oc-chat-layout min-h-0 flex-1">
              <ModernChatPanel
                variant="focus"
                conversationId={conversationId}
                onConversationCreated={setConversationId}
                pageContext={page}
                className="min-h-0 flex-1"
              />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
