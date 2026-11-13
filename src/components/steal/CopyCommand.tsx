'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** A shell command shown in full, with one tap to copy it. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The command stays visible and selectable, so a blocked clipboard
      // costs a manual select, not the step.
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-2 rounded-lg border border-default bg-surface-base px-3 py-2">
      {/* Focusable, so a keyboard can scroll a command that runs past the box. */}
      <code
        tabIndex={0}
        className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-sm font-mono text-sm text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg-primary"
      >
        {command}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy command'}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-fg-secondary hover:text-fg-primary"
      >
        {copied ? <Check className="h-4 w-4 text-status-positive" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
