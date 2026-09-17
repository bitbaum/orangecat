/**
 * Template Component Factory
 *
 * Generates template components from consolidated template data.
 * Eliminates ~800 lines of boilerplate by reusing TemplatePicker.
 *
 * Created: 2025-12-27
 * Last Modified: 2025-12-27
 * Last Modified Summary: Factory function to generate template components
 */

'use client';

import { TemplatePicker, type GenericTemplate } from './TemplatePicker';
import {
  PRODUCT_TEMPLATES,
  SERVICE_TEMPLATES,
  CAUSE_TEMPLATES,
  LOAN_TEMPLATES,
  AI_ASSISTANT_TEMPLATES,
  PROJECT_TEMPLATES,
  ASSET_TEMPLATES,
  EVENT_TEMPLATES,
} from './templates-data';
import { GROUP_TEMPLATES } from './group-templates';
import { WISHLIST_TEMPLATES } from './wishlist-templates';

// ==================== FACTORY FUNCTION ====================

/**
 * Creates a template component for a given entity type
 * Extracts defaults from EntityTemplate to match CreateEntityWorkflow's expected Partial<T> type
 */
function createTemplateComponent<T extends GenericTemplate>(templates: T[], label: string) {
  return function EntityTemplates({
    onSelectTemplate,
    className = '',
  }: {
    onSelectTemplate: (template: Partial<Record<string, any>>) => void;
    className?: string;
  }) {
    const handleSelect = (template: T) => {
      // Extract just the defaults from the template
      // EntityTemplate has a 'defaults' property that contains the form data
      onSelectTemplate(template.defaults || {});
    };

    return (
      <TemplatePicker
        label={label}
        templates={templates}
        onSelectTemplate={handleSelect}
        className={className}
      />
    );
  };
}

// ==================== GENERATED COMPONENTS ====================

export const ProductTemplates = createTemplateComponent(PRODUCT_TEMPLATES, 'Products');
export const ServiceTemplates = createTemplateComponent(SERVICE_TEMPLATES, 'Services');
export const CauseTemplates = createTemplateComponent(CAUSE_TEMPLATES, 'Causes');
export const LoanTemplates = createTemplateComponent(LOAN_TEMPLATES, 'Loans');
export const AIAssistantTemplates = createTemplateComponent(
  AI_ASSISTANT_TEMPLATES,
  'AI Assistants'
);
export const ProjectTemplates = createTemplateComponent(PROJECT_TEMPLATES, 'Projects');
export const AssetTemplates = createTemplateComponent(ASSET_TEMPLATES, 'Assets');
export const EventTemplates = createTemplateComponent(EVENT_TEMPLATES, 'Events');
export const GroupTemplates = createTemplateComponent(GROUP_TEMPLATES, 'Organizations');
export const WishlistTemplates = createTemplateComponent(WISHLIST_TEMPLATES, 'Wishlists');

// ==================== TYPE EXPORTS ====================

export type ProductTemplate = (typeof PRODUCT_TEMPLATES)[number];
export type ServiceTemplate = (typeof SERVICE_TEMPLATES)[number];
export type CauseTemplate = (typeof CAUSE_TEMPLATES)[number];
export type LoanTemplate = (typeof LOAN_TEMPLATES)[number];
export type AIAssistantTemplate = (typeof AI_ASSISTANT_TEMPLATES)[number];
export type ProjectTemplate = (typeof PROJECT_TEMPLATES)[number];
export type AssetTemplate = (typeof ASSET_TEMPLATES)[number];
export type EventTemplate = (typeof EVENT_TEMPLATES)[number];
export type GroupTemplate = (typeof GROUP_TEMPLATES)[number];

// ==================== TEMPLATE ARRAY EXPORTS ====================

export {
  PRODUCT_TEMPLATES,
  SERVICE_TEMPLATES,
  CAUSE_TEMPLATES,
  LOAN_TEMPLATES,
  AI_ASSISTANT_TEMPLATES,
  PROJECT_TEMPLATES,
  ASSET_TEMPLATES,
  EVENT_TEMPLATES,
};
