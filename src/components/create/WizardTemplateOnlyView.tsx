'use client';

import { ArrowLeft } from 'lucide-react';
import { WizardTemplatePicker } from './templates/WizardTemplatePicker';
import type { EntityConfig, EntityTemplate } from './types';

interface WizardTemplateOnlyViewProps<T extends Record<string, unknown>> {
  config: EntityConfig<T>;
  onCancel: () => void;
  onSelectTemplate: (template: EntityTemplate<T> | null) => void;
}

export function WizardTemplateOnlyView<T extends Record<string, unknown>>({
  config,
  onCancel,
  onSelectTemplate,
}: WizardTemplateOnlyViewProps<T>) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <button
          onClick={onCancel}
          className="inline-flex items-center text-fg-secondary hover:text-fg-primary mb-4 transition-colors pointer-coarse:min-h-11"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Cancel
        </button>
        <h1 className="text-3xl font-bold text-fg-primary mb-2">{config.pageTitle}</h1>
        <p className="text-fg-secondary">{config.pageDescription}</p>
      </div>

      <WizardTemplatePicker
        templates={(config.templates || []) as EntityTemplate<T>[]}
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={null}
        showStartFromScratch
      />
      {/* The WizardTemplatePicker already renders a "Start from scratch"
          card (and pre-selects it) when showStartFromScratch=true, so an
          extra link with the same affordance below the grid is just
          duplicate UI — confused users into thinking they were two
          different paths. Card wins; remove the bottom link. */}
    </div>
  );
}
