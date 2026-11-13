/**
 * WizardTemplatePicker - the list of templates a create form can start from.
 *
 * Opened on demand from "Start from a template" (CreateTemplateOffer); the
 * form is already on the page behind it, so there is no "Start from scratch"
 * choice — closing the sheet is that.
 *
 * - Below sm: one bordered list of rows (icon tile, name, one-line tagline),
 *   the create chooser's row anatomy. Full-height cards made a phone scroll
 *   past up to 50 of them.
 * - From sm: two columns of cards.
 * - A check is drawn only for a template the person actually picked.
 */

'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityTemplate } from '../types';

interface WizardTemplatePickerProps<T extends EntityTemplate> {
  templates: T[];
  onSelectTemplate: (template: T) => void;
  /** The template already applied, if any. Nothing is checked otherwise. */
  selectedTemplateId?: string | null;
  className?: string;
}

export function WizardTemplatePicker<T extends EntityTemplate>({
  templates,
  onSelectTemplate,
  selectedTemplateId,
  className,
}: WizardTemplatePickerProps<T>) {
  return (
    <ul
      className={cn(
        'divide-y divide-subtle rounded-lg border border-default bg-surface-base',
        'sm:grid sm:grid-cols-2 sm:gap-4 sm:divide-y-0 sm:rounded-none sm:border-0 sm:bg-transparent',
        className
      )}
    >
      {templates.map(template => {
        const isSelected = selectedTemplateId === template.id;
        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onSelectTemplate(template)}
              aria-pressed={isSelected}
              className={cn(
                'relative flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                'hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'sm:h-full sm:min-h-[120px] sm:flex-col sm:items-start sm:rounded-md sm:border sm:p-5',
                isSelected
                  ? 'bg-surface-raised sm:border-strong'
                  : 'sm:border-subtle sm:bg-surface-page'
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-subtle bg-surface-raised text-fg-primary sm:h-12 sm:w-12">
                {template.icon}
              </span>
              <span className="min-w-0 flex-1 pr-8">
                <span className="block truncate text-sm font-semibold text-fg-primary sm:whitespace-normal sm:text-base">
                  {template.name}
                </span>
                <span className="block truncate text-sm text-fg-secondary sm:line-clamp-2 sm:whitespace-normal">
                  {template.tagline}
                </span>
              </span>
              {isSelected && (
                <span className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-fg-primary sm:top-3 sm:translate-y-0">
                  <Check className="h-4 w-4 text-fg-inverted" aria-hidden />
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
