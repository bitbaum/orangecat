/**
 * Base Entity Config Factory
 *
 * Reduces boilerplate in entity config files by providing common structure
 * and helper functions for field patterns.
 *
 * Created: 2025-12-27
 * Last Modified: 2025-12-27
 * Last Modified Summary: Base factory to reduce entity config boilerplate
 */

import type { LucideIcon } from 'lucide-react';
import type {
  EntityConfig,
  FieldGroup,
  FieldConfig,
  GuidanceContent,
  WizardConfig,
  EntityTemplate,
} from '@/components/create/types';
import type { ZodType } from 'zod';
import { getEntityMetadata, type EntityType } from '@/config/entity-registry';
import { ENTITY_COVER } from '@/config/entity-cover';

/**
 * The picture field every kind's form shows, from ENTITY_COVER. One
 * definition: the same control (upload, paste, find or generate), the same
 * place (right under the description), the same words.
 */
export function coverPictureField(entityType: EntityType): FieldConfig | null {
  const cover = ENTITY_COVER[entityType];
  if (!cover) {
    return null;
  }
  return {
    name: cover.field,
    label: cover.label,
    type: 'image',
    hint: 'Shown on its page, on Discover and when the link is shared.',
    colSpan: 2,
  };
}

/** `name` placed right after `anchor` (or last when there is no anchor). */
function insertAfter<T>(items: readonly T[], item: T, isAnchor: (candidate: T) => boolean): T[] {
  const at = items.findIndex(isAnchor);
  return at < 0 ? [...items, item] : [...items.slice(0, at + 1), item, ...items.slice(at + 1)];
}

/** The field groups with the cover field under the description, exactly once. */
export function withCoverField(entityType: EntityType, groups: FieldGroup[]): FieldGroup[] {
  const field = coverPictureField(entityType);
  if (!field) {
    return groups;
  }
  const without = groups.map(group =>
    group.fields ? { ...group, fields: group.fields.filter(f => f.name !== field.name) } : group
  );
  const home = Math.max(
    without.findIndex(group => group.fields?.some(f => f.name === 'description')),
    without.findIndex(group => Array.isArray(group.fields))
  );
  return without.map((group, i) =>
    i === home && group.fields
      ? { ...group, fields: insertAfter(group.fields, field, f => f.name === 'description') }
      : group
  );
}

/** A wizard shows only the fields its steps name: the cover joins the description's step. */
function withCoverStep(entityType: EntityType, wizard?: WizardConfig): WizardConfig | undefined {
  const name = ENTITY_COVER[entityType]?.field;
  if (!wizard || !name || wizard.steps.some(step => step.fields.includes(name))) {
    return wizard;
  }
  const home = Math.max(
    wizard.steps.findIndex(step => step.fields.includes('description')),
    0
  );
  return {
    ...wizard,
    steps: wizard.steps.map((step, i) =>
      i === home
        ? { ...step, fields: insertAfter(step.fields, name, f => f === 'description') }
        : step
    ),
  };
}

/**
 * Common field definitions that appear in most entity forms
 */
export const commonFields = {
  title: (options?: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    colSpan?: 1 | 2;
  }): FieldConfig => ({
    name: 'title',
    label: options?.label ?? 'Title',
    type: 'text',
    placeholder: options?.placeholder ?? 'Enter a title...',
    required: options?.required ?? true,
    colSpan: (options?.colSpan ?? 2) as 1 | 2,
  }),

  description: (options?: {
    label?: string;
    placeholder?: string;
    rows?: number;
    required?: boolean;
    colSpan?: 1 | 2;
    hint?: string;
  }): FieldConfig => ({
    name: 'description',
    label: options?.label ?? 'Description',
    type: 'textarea',
    placeholder: options?.placeholder ?? 'Describe in detail...',
    rows: options?.rows ?? 4,
    required: options?.required ?? false,
    colSpan: (options?.colSpan ?? 2) as 1 | 2,
    hint: options?.hint,
  }),

  category: (options?: {
    label?: string;
    placeholder?: string;
    required?: boolean;
    colSpan?: 1 | 2;
  }): FieldConfig => ({
    name: 'category',
    label: options?.label ?? 'Category',
    type: 'text',
    placeholder: options?.placeholder ?? 'e.g., Category name',
    required: options?.required ?? false,
    colSpan: (options?.colSpan ?? 1) as 1 | 2,
  }),
};

/**
 * Base config factory options
 */
export interface BaseConfigOptions<T extends object> {
  /** Entity type from registry (excluding wallet) */
  entityType: Exclude<EntityType, 'wallet'>;
  /** Display name (singular). Defaults to entity registry metadata. */
  name?: string;
  /** Display name (plural). Defaults to entity registry metadata. */
  namePlural?: string;
  /** Entity icon. Defaults to entity registry metadata. */
  icon?: LucideIcon;
  /** Primary color theme. Defaults to entity registry metadata. */
  colorTheme?: 'orange' | 'tiffany' | 'rose' | 'green';
  /** Back link URL. Defaults to entity registry dashboard path. */
  backUrl?: string;
  /** Success redirect URL. Defaults to entity registry dashboard detail path. */
  successUrl?: string;
  /** Page title */
  pageTitle: string;
  /** Page description */
  pageDescription: string;
  /** Form title */
  formTitle: string;
  /** Form description */
  formDescription: string;
  /** Field groups */
  fieldGroups: FieldGroup[];
  /** Zod validation schema */
  validationSchema: ZodType<T, unknown>;
  /** Default form values */
  defaultValues: T;
  /** Field-specific guidance content */
  guidanceContent: Record<string, GuidanceContent>;
  /** Default guidance when no field selected */
  defaultGuidance: {
    title: string;
    description: string;
    features: Array<{
      icon: React.ReactNode;
      text: string;
    }>;
    hint?: string;
  };
  /** Optional templates */
  templates?: EntityTemplate[];
  /** Optional info banner */
  infoBanner?: {
    title: string;
    content: string;
    variant: 'info' | 'warning' | 'success';
  };
  /** Optional success message */
  successMessage?: string;
  /** Optional redirect delay */
  successRedirectDelay?: number;
  /** Optional wizard configuration for multi-step creation flow */
  wizardConfig?: WizardConfig;
  /** Optional derivation of UI-only form values from loaded data (see EntityConfig) */
  deriveInitialValues?: (data: T) => Partial<T>;
}

/**
 * Create entity config with common structure
 *
 * This factory reduces boilerplate by:
 * - Deriving API endpoint from entity registry
 * - Ensuring consistent structure
 * - Type safety
 *
 * @example
 * ```typescript
 * export const productConfig = createEntityConfig({
 *   entityType: 'product',
 *   name: 'Product',
 *   namePlural: 'Products',
 *   icon: Package,
 *   colorTheme: 'orange',
 *   backUrl: '/dashboard/store',
 *   successUrl: '/dashboard/store',
 *   pageTitle: 'Create Product',
 *   // ... rest of config
 * });
 * ```
 */
export function createEntityConfig<T extends object>(
  options: BaseConfigOptions<T>
): EntityConfig<T> {
  const meta = getEntityMetadata(options.entityType);

  return {
    type: options.entityType,
    name: options.name ?? meta.name,
    namePlural: options.namePlural ?? meta.namePlural,
    icon: options.icon ?? meta.icon,
    colorTheme: options.colorTheme ?? meta.colorTheme,
    backUrl: options.backUrl ?? meta.basePath,
    apiEndpoint: meta.apiEndpoint, // Use registry as SSOT
    successUrl: options.successUrl ?? `${meta.basePath}/[id]`,
    pageTitle: options.pageTitle,
    pageDescription: options.pageDescription,
    formTitle: options.formTitle,
    formDescription: options.formDescription,
    fieldGroups: withCoverField(options.entityType, options.fieldGroups),
    validationSchema: options.validationSchema,
    defaultValues: options.defaultValues,
    guidanceContent: options.guidanceContent,
    defaultGuidance: options.defaultGuidance,
    templates: options.templates,
    infoBanner: options.infoBanner,
    successMessage: options.successMessage,
    successRedirectDelay: options.successRedirectDelay,
    wizardConfig: withCoverStep(options.entityType, options.wizardConfig),
    deriveInitialValues: options.deriveInitialValues,
  };
}
