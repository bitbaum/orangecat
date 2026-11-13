'use client';

import { useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIP_COPY } from '@/config/tips';
import TipDialog from './TipDialog';

/**
 * Opens the tip dialog for a given person. The Zap uses Bitcoin Orange — this is
 * genuinely Bitcoin-specific UI (a Bitcoin gift), the one place that color rule
 * permits it. Reusable on articles, posts, and profiles.
 */
export default function TipButton({
  username,
  recipientName,
  className,
}: {
  username: string;
  recipientName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-md border border-default px-3 py-1.5 text-sm font-medium text-fg-primary transition-colors hover:bg-surface-raised',
          className
        )}
      >
        <Zap className="h-4 w-4 text-bitcoinOrange" />
        {TIP_COPY.button}
      </button>
      <TipDialog
        open={open}
        onOpenChange={setOpen}
        username={username}
        recipientName={recipientName}
      />
    </>
  );
}
