'use client';

/**
 * The one frame for Receive, Send, and Request.
 *
 * Those three routes are one money surface. Each screen used to rebuild the
 * column, the heading, and the tab row, so the chrome drifted (tabs at the
 * top on one page, at the bottom on another; an icon beside two of the three
 * titles and none beside the third). The payment behaviour stays in the
 * screen. This only owns the frame, and the frame is identical on every tab:
 * title, one line under it, the tabs, the content.
 */

import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { MoneyTabs } from '@/components/money/MoneyTabs';

interface MoneyPageProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function MoneyPage({ title, subtitle, children }: MoneyPageProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <PageHeading>{title}</PageHeading>
      {subtitle && <p className="mb-0 mt-1 text-sm text-fg-secondary">{subtitle}</p>}
      <MoneyTabs className="mt-5" />
      <div className="mt-6">{children}</div>
    </div>
  );
}

/**
 * A state that stands in for the form (first run, no wallet): one question as
 * the heading, one sentence, then whatever leads on. Same frame as the form,
 * so the page title and tabs never change under the person's thumb.
 */
export function MoneyPrompt({
  heading,
  body,
  children,
}: {
  heading: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="mb-0 font-heading text-lg font-semibold tracking-display text-fg-primary">
          {heading}
        </h2>
        {body && <p className="mb-0 text-sm text-fg-secondary">{body}</p>}
      </div>
      {children}
    </div>
  );
}

export function MoneyLoading() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin text-fg-tertiary" />
    </div>
  );
}
