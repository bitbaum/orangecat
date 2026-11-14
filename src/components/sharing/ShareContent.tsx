'use client';

import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ShareRow } from './ShareRow';

export interface ShareContentProps {
  title: string;
  description: string;
  url: string;
  onClose?: () => void;
  className?: string;
  showTitle?: boolean;
  titleText?: string;
}

/**
 * The share panel for a profile, a project or any entity: a heading, a close
 * button and the same `ShareRow` a wall post and an article use — one shared
 * experience everywhere, from `@bitbaum/bip-kit`.
 *
 * On a phone with a close handler it is a dialog; DialogContent is then the
 * one frame and owns the one close button. Elsewhere it is a framed panel
 * (a dropdown under its button) with its own close button.
 */
export default function ShareContent({
  title,
  description,
  url,
  onClose,
  className = '',
  showTitle = true,
  titleText = 'Share',
}: ShareContentProps) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const inDialog = isMobile && !!onClose;

  const row = (
    <ShareRow url={url} title={title} summary={description} labels={{ landmark: titleText }} />
  );

  if (inDialog) {
    return (
      <Dialog open onOpenChange={open => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogTitle className={showTitle ? 'pr-12' : 'sr-only'}>{titleText}</DialogTitle>
          {row}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div
      className={`w-[min(28rem,calc(100vw-1.5rem))] max-w-full rounded-lg border border-default bg-surface-base p-4 shadow-sm ${className}`}
      onClick={e => e.stopPropagation()}
    >
      {showTitle && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="mb-0 text-base font-semibold text-fg-primary">{titleText}</h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
              aria-label="Close share menu"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          )}
        </div>
      )}
      {row}
    </div>
  );
}
