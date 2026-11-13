/**
 * WizardTemplatePicker - Featured template selector for wizard flows
 *
 * Displays templates prominently as cards in a grid layout, designed to be
 * the main content of a wizard step (unlike TemplatePicker which is a helper).
 *
 * Features:
 * - Responsive grid layout (1 col mobile, 2 col tablet+)
 * - "Start from scratch" option
 * - Visual highlighting on selection
 * - Works with any entity's templates
 * - Touch-friendly (44px+ touch targets)
 *
 * Created: 2026-01-20
 */

'use client';

import { useState, useEffect } from 'react';
import { Check, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EntityTemplate } from '../types';

interface WizardTemplatePickerProps<T extends EntityTemplate> {
  templates: T[];
  onSelectTemplate: (template: T | null) => void;
  selectedTemplateId?: string | null;
  /**
   * Show "Start from scratch" as already chosen while nothing else is. Right
   * where a Next button follows the grid (the wizard); wrong where picking a
   * card is the only way on: a ticked card with nothing after it is a dead end.
   */
  preselectScratch?: boolean;
  showStartFromScratch?: boolean;
  entityLabel?: string;
  className?: string;
}

export function WizardTemplatePicker<T extends EntityTemplate>({
  templates,
  onSelectTemplate,
  selectedTemplateId,
  preselectScratch = true,
  showStartFromScratch = true,
  entityLabel,
  className,
}: WizardTemplatePickerProps<T>) {
  // undefined = nothing chosen yet; null = Start from scratch.
  const [selected, setSelected] = useState<string | null | undefined>(
    selectedTemplateId ?? (preselectScratch ? null : undefined)
  );

  // Sync with external state
  useEffect(() => {
    if (selectedTemplateId !== undefined) {
      setSelected(selectedTemplateId);
    }
  }, [selectedTemplateId]);

  const handleSelect = (templateId: string | null) => {
    setSelected(templateId);
    if (templateId === null) {
      onSelectTemplate(null);
    } else {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        onSelectTemplate(template);
      }
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Start from scratch option */}
        {showStartFromScratch && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              'relative flex min-h-[120px] flex-col items-start rounded-md border p-4 text-left transition-colors sm:p-5',
              'hover:border-strong hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              selected === null
                ? 'border-strong bg-surface-raised ring-2 ring-ring/20'
                : 'border-subtle bg-surface-page'
            )}
          >
            {selected === null && (
              <div className="absolute top-3 right-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-fg-primary">
                  <Check className="h-4 w-4 text-fg-inverted" />
                </div>
              </div>
            )}
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-surface-raised text-fg-secondary sm:mb-4 sm:h-12 sm:w-12">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-fg-primary mb-1">
              Start from scratch
            </h3>
            <p className="text-xs sm:text-sm text-fg-secondary">
              {entityLabel
                ? `Create a blank ${entityLabel.toLowerCase()}`
                : 'Start with a blank form'}
            </p>
          </button>
        )}

        {/* Template options */}
        {templates.map(template => {
          const isSelected = selected === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => handleSelect(template.id)}
              className={cn(
                'relative flex min-h-[120px] flex-col items-start rounded-md border p-4 text-left transition-colors sm:p-5',
                'hover:border-strong hover:bg-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected
                  ? 'border-strong bg-surface-raised ring-2 ring-ring/20'
                  : 'border-subtle bg-surface-page'
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-fg-primary">
                    <Check className="h-4 w-4 text-fg-inverted" />
                  </div>
                </div>
              )}
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-subtle bg-surface-raised text-fg-primary sm:mb-4 sm:h-12 sm:w-12">
                {template.icon}
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-fg-primary mb-1 pr-8">
                {template.name}
              </h3>
              <p className="text-xs sm:text-sm text-fg-secondary line-clamp-2">
                {template.tagline}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
