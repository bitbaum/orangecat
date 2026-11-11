'use client';

/**
 * What a chat is, one tap from its name: the face, the name, the job, and the
 * few things a person can do from here (open the profile, read what it
 * remembers, rename or delete a group). One sheet for all three kinds; only
 * the rows differ.
 */

import type { ReactNode } from 'react';
import { Sheet } from '@bitbaum/chatkit/react';
import { COMPANION_COPY } from '@/config/companions';

export function TalkDetailsSheet({
  open,
  onClose,
  title,
  face,
  lines,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  face: ReactNode;
  /** One short line each, under the name: the job, the disclosure, where it answers from. */
  lines: ReadonlyArray<string | null | undefined>;
  children?: ReactNode;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={COMPANION_COPY.talk.details}
      closeLabel={COMPANION_COPY.talk.close}
    >
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          {face}
          <p className="mb-0 text-xl font-semibold text-fg-primary">{title}</p>
          {lines.filter(Boolean).map((line, i) => (
            <p key={i} className="mb-0 max-w-prose text-sm text-fg-secondary">
              {line}
            </p>
          ))}
        </div>
        {children}
      </div>
    </Sheet>
  );
}

/** A row in the details sheet: one anatomy, a label that says what happens. */
export function DetailRow({
  children,
  onClick,
  href,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const cls = `flex min-h-[48px] w-full items-center rounded-2xl px-4 text-left text-base hover:bg-surface-hover ${
    danger ? 'text-status-negative' : 'text-fg-primary'
  }`;
  if (href) {
    return (
      <a href={href} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}
