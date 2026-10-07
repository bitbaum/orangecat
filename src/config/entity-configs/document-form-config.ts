/**
 * DOCUMENT ENTITY CONFIGURATION (FORM)
 *
 * Defines the form structure, validation, and guidance for document creation.
 * Documents provide personal context for My Cat AI assistant.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-01-20
 * Last Modified Summary: Initial document form configuration
 */

import { FileText } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { documentSchema, type DocumentFormData } from '@/lib/validation';
import {
  documentGuidanceContent,
  documentDefaultGuidance,
} from '@/lib/entity-guidance/document-guidance';
import type { FieldGroup } from '@/components/create/types';
import { createEntityConfig } from './base-config-factory';
import { DOCUMENT_TYPE_OPTIONS, VISIBILITY_OPTIONS } from '@/config/entities/documents';

// ==================== FIELD GROUPS ====================

const fieldGroups: FieldGroup[] = [
  {
    id: 'basic',
    title: 'Basic Information',
    description: 'Give your document a clear title',
    fields: [
      {
        name: 'title',
        label: 'Document Title',
        type: 'text',
        placeholder: 'e.g., My 2026 Goals, Financial Situation, Skills Summary',
        required: true,
        colSpan: 2,
      },
    ],
  },
  {
    id: 'type',
    title: 'Document Type',
    description: 'Choose the type that best describes this document',
    fields: [
      {
        name: 'document_type',
        label: 'Type',
        type: 'select',
        required: true,
        options: [...DOCUMENT_TYPE_OPTIONS],
        colSpan: 1,
      },
      {
        name: 'visibility',
        label: 'Visibility',
        type: 'select',
        required: true,
        options: [...VISIBILITY_OPTIONS],
        colSpan: 1,
        hint: 'Choose "Cat Only" for documents you want your Cat to use for personalized advice.',
      },
    ],
  },
  {
    id: 'content',
    title: 'Content',
    description: 'Write the information you want your Cat to know',
    fields: [
      {
        name: 'content',
        label: 'Document Content',
        type: 'textarea',
        placeholder:
          'Write about your goals, skills, finances, or any other context that will help your Cat give you better advice...',
        rows: 12,
        colSpan: 2,
        hint: 'Be detailed - the more context you provide, the better advice your Cat can give.',
      },
    ],
  },
  {
    id: 'tags',
    title: 'Organization',
    description: 'Add tags to help organize your documents',
    fields: [
      {
        name: 'tags',
        label: 'Tags',
        type: 'tags',
        placeholder: 'Add tags, separated by commas',
        colSpan: 2,
        hint: 'Optional: Add keywords to help find and organize this document.',
      },
    ],
  },
];

// ==================== CONFIGURATION ====================

export const documentFormConfig = createEntityConfig<DocumentFormData>({
  entityType: 'document',
  name: 'Document',
  namePlural: 'Documents',
  icon: FileText,
  colorTheme: 'tiffany',
  backUrl: `${ROUTES.DASHBOARD.CAT}?tab=context`,
  successUrl: `${ROUTES.DASHBOARD.CAT}?tab=context`,
  pageTitle: 'Add Context',
  pageDescription: 'Add a document to help your Cat understand your goals, skills, and situation.',
  formTitle: 'Document Details',
  formDescription: 'Provide context that your Cat can use to give you personalized advice',
  fieldGroups,
  validationSchema: documentSchema,
  defaultValues: {
    title: '',
    content: '',
    document_type: 'notes',
    visibility: 'cat_visible',
    tags: [],
  },
  guidanceContent: documentGuidanceContent,
  defaultGuidance: documentDefaultGuidance,
  infoBanner: {
    title: 'Help Your Cat Help You',
    content:
      'Documents you mark as "Cat Only" or "Public" will be used by your Cat to give you personalized advice.',
    variant: 'info',
  },
  successMessage: 'Document saved. Your Cat now has more context to help you.',
  successRedirectDelay: 1500,
});
