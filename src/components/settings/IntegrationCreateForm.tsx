'use client';
import type { FormEvent, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { UI_TOKENS } from '@/config/design-system';
import { cn } from '@/lib/utils';

/** Keep credential creation deliberate and the existing integrations easy to reach. */
export function IntegrationCreateForm({
  title,
  disabled,
  onSubmit,
  children,
}: {
  title: string;
  disabled: boolean;
  onSubmit: (event: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-lg border border-subtle bg-surface-raised/20 p-4">
      <summary
        className={cn(
          'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-base font-medium text-fg-primary',
          UI_TOKENS.focus
        )}
      >
        {title}
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
        />
      </summary>
      <form aria-label={title} onSubmit={onSubmit} className="mt-3">
        <fieldset disabled={disabled} className="min-w-0 space-y-3">
          {children}
        </fieldset>
      </form>
    </details>
  );
}
