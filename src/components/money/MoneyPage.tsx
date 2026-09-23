'use client';

/**
 * The one frame for Receive, Send, and Request.
 *
 * Those three routes are one money surface. Each screen used to rebuild the
 * column, the heading, and the tab row, so the chrome drifted (tabs at the
 * top on one page, at the bottom on another). The payment behaviour stays in
 * the screen. This only owns the frame.
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { MoneyTabs } from '@/components/money/MoneyTabs';

interface MoneyPageProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export function MoneyPage({ title, subtitle, icon: Icon, children }: MoneyPageProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <PageHeading className="flex items-center gap-2">
        {Icon && <Icon className="h-6 w-6 shrink-0 text-fg-secondary" aria-hidden="true" />}
        {title}
      </PageHeading>
      {subtitle && <p className="mt-1 text-sm text-fg-secondary">{subtitle}</p>}
      <MoneyTabs className="mt-5" />
      <div className="mt-6">{children}</div>
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
