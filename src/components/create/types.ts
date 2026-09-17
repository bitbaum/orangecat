/**
 * UNIFIED ENTITY CREATION SYSTEM - Types
 *
 * Shared type definitions for the modular entity creation system.
 * Enables consistent form building across products, services, causes, etc.
 *
 * SINGLE SOURCE OF TRUTH for:
 * - Field configuration types
 * - Entity configuration types
 * - Template types
 * - Guidance types
 * - Form state types
 *
 * Created: 2025-12-03
 * Last Modified: 2025-12-16
 * Last Modified Summary: Added unified template types and improved documentation
 */

import { ReactNode, ComponentType } from 'react';
import { LucideIcon } from 'lucide-react';
import { ZodType } from 'zod';
import type { EntityType } from '@/config/entity-registry';
import type { AiErrorCode } from '@/config/ai-errors';

// ==================== FIELD TYPES ====================

export type FieldInputType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'boolean'
  | 'date'
  | 'url'
  | 'email'
  | 'phone'
  | 'currency'
  | 'bitcoin_address'
  | 'tags'
  | 'availability';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface FieldConfig {
  /** Unique field identifier */
  name: string;
  /** Display label */
  label: string;
  /** Input type */
  type: FieldInputType;
  /** Placeholder text */
  placeholder?: string;
  /** Whether field is required */
  required?: boolean;
  /** Options for select/radio fields */
  options?: SelectOption[] | readonly SelectOption[];
  /** Hint text shown below field */
  hint?: string;
  /** Min value for number fields */
  min?: number;
  /** Max value for number fields */
  max?: number;
  /** Step value for number fields */
  step?: number;
  /** Number of rows for textarea */
  rows?: number;
  /** Conditional visibility based on other fields */
  showWhen?: {
    field: string;
    value: string | string[] | boolean;
  };
  /**
   * Sibling fields reset to null when THIS field's value changes — for
   * mode-toggle fields (e.g. hourly vs fixed pricing) so a value entered under
   * the previous mode never rides along invisibly into the submit.
   */
  clearOnChange?: string[];
  /**
   * Currency fields only: true when the amount is a FUNDING GOAL (project /
   * cause / event goals) — enables the goal explainer under the input. Price
   * and amount fields must leave this unset.
   */
  isGoal?: boolean;
  /** Field depends on another field's value */
  dependsOn?:
    | string
    | {
        field: string;
        value?: string | string[] | boolean;
      };
  /** Default value for the field */
  defaultValue?: unknown;
  /** Field grouping */
  group?: string;
  /** Column span (1 or 2 for grid layout) */
  colSpan?: 1 | 2;
}

export interface FieldGroup {
  /** Group identifier */
  id: string;
  /** Group title */
  title: string;
  /** Group description */
  description?: string;
  /** Fields in this group */
  fields?: FieldConfig[];
  /** Custom component to render instead of fields (for complex components like collateral) */
  customComponent?: ComponentType<{
    formData: Record<string, unknown>;
    onFieldChange: (field: string, value: unknown) => void;
    disabled?: boolean;
  }>;
  /** Conditional display based on another field's value */
  conditionalOn?: {
    field: string;
    value: string | string[];
  };
}

// ==================== WIZARD TYPES ====================

/**
 * Configuration for a wizard step
 * Used when entity creation requires multi-step progressive disclosure
 */
export interface WizardStep {
  /** Step identifier (should match fieldGroup id for form steps) */
  id: string;
  /** Step title displayed in progress indicator */
  title: string;
  /** Step description shown in the step content area */
  description: string;
  /** Whether this step can be skipped */
  optional?: boolean;
  /** Field names to display in this step (empty for template step) */
  fields: string[];
}

/**
 * Wizard configuration for entity creation
 * When defined, enables multi-step wizard UI instead of single-page form
 */
export interface WizardConfig {
  /** Whether wizard mode is enabled */
  enabled: boolean;
  /** Wizard steps configuration */
  steps: WizardStep[];
  /** Whether to include template selection as first step */
  includeTemplateStep?: boolean;
}

// ==================== GUIDANCE TYPES ====================

export interface GuidanceContent {
  /** Icon component */
  icon: ReactNode;
  /** Field title */
  title: string;
  /** Main description */
  description: string;
  /** Best practice tips */
  tips: string[];
  /** Example values */
  examples?: string[];
}

export interface DefaultGuidance {
  /** Default panel title */
  title: string;
  /** Default description */
  description: string;
  /** Feature highlights */
  features: Array<{
    icon: ReactNode;
    text: string;
  }>;
  /** Hint text */
  hint?: string;
}

// ==================== ENTITY CONFIGURATION ====================

export interface EntityConfig<T extends Record<string, any> = Record<string, any>> {
  /** Entity type identifier */
  type: EntityType | 'organization';
  /** Display name (singular) */
  name: string;
  /** Display name (plural) */
  namePlural: string;
  /** Entity icon */
  icon: LucideIcon;
  /** Primary color theme */
  colorTheme: 'orange' | 'tiffany' | 'rose' | 'green';
  /** Back link URL */
  backUrl: string;
  /** API endpoint for CRUD */
  apiEndpoint: string;
  /** Success redirect URL (use [field] placeholders, e.g., /products/[id]) */
  successUrl: string;
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
  /** Zod validation schema - uses ZodType for flexibility with defaults/transforms */
  validationSchema: ZodType<T, unknown>;
  /** Default form values */
  defaultValues: T;
  /** Field-specific guidance content */
  guidanceContent: Record<string, GuidanceContent>;
  /** Default guidance when no field selected */
  defaultGuidance: DefaultGuidance;
  /** Optional info banner */
  infoBanner?: {
    title: string;
    content: string;
    variant: 'info' | 'warning' | 'success';
  };
  /** Optional templates for quick-start */
  templates?: EntityTemplate<T>[] | unknown[];
  /** Optional success message after creation */
  successMessage?: string;
  /** Optional delay before redirecting after success (ms) */
  successRedirectDelay?: number;
  /** Optional wizard configuration for multi-step creation flow */
  wizardConfig?: WizardConfig;
  /**
   * Derive UI-only form values from loaded data (create defaults or an edit
   * row) — e.g. infer the service pricing toggle from which price is set.
   * Runs after defaults + initialValues are merged.
   */
  deriveInitialValues?: (data: T) => Partial<T>;
}

// ==================== FORM STATE ====================

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
  activeField: string | null;
}

export interface FormActions<T> {
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  setActiveField: (field: string | null) => void;
  submit: () => Promise<void>;
  reset: () => void;
}

// ==================== COMPONENT PROPS ====================

export interface EntityFormProps<T extends Record<string, any>> {
  config: EntityConfig<T>;
  initialValues?: Partial<T>;
  onSuccess?: (data: T & { id: string }) => void;
  onError?: (error: string) => void;
  mode?: 'create' | 'edit';
  entityId?: string;
}

export interface FormFieldProps {
  config: FieldConfig;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  onFocus: () => void;
  onBlur?: () => void;
  /** Optional callback when currency changes (for currency input fields) */
  onCurrencyChange?: (currency: string) => void;
  /** Current currency value (for currency input fields) */
  currency?: string;
  disabled?: boolean;
}

export interface GuidancePanelProps {
  activeField: string | null;
  guidanceContent: Record<string, GuidanceContent>;
  defaultGuidance: DefaultGuidance;
  /** Optional additional content (e.g., currency converter) */
  additionalContent?: ReactNode;
}

// ==================== TEMPLATE TYPES ====================

/**
 * Unified template interface - SINGLE SOURCE OF TRUTH
 *
 * All entity templates (Products, Services, Assets, Projects, etc.)
 * must conform to this interface for consistency.
 *
 * Note: Use `defaults` (not `data`) to store the prefill values.
 */
export interface EntityTemplate<T extends Record<string, any> = Record<string, any>> {
  /** Unique identifier for the template */
  id: string;
  /** Icon to display (ReactNode, typically a Lucide icon) */
  icon: ReactNode;
  /** Display name for the template */
  name: string;
  /** Short description/tagline */
  tagline: string;
  /** Category for grouping templates (optional) */
  category?: string;
  /** Default values to prefill the form with */
  defaults: Partial<T>;
}

/**
 * Props for template picker/selector components
 */
export interface TemplatePickerProps<T extends EntityTemplate> {
  /** Label to display (e.g., "Products", "Services") */
  label: string;
  /** Array of available templates */
  templates: T[];
  /** Callback when a template is selected */
  onSelectTemplate: (template: T) => void;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Return type for useTemplateSelection hook
 */
export interface UseTemplateSelectionReturn<T extends Record<string, unknown>> {
  /** Current template values (empty object if none selected) */
  templateValues: Partial<T>;
  /** Config with merged default values */
  mergedConfig: EntityConfig<T>;
  /** Handler to call when template is selected */
  handleSelectTemplate: (template: EntityTemplate<T>) => void;
  /** Reset template selection */
  resetTemplate: () => void;
  /** Whether a template has been selected */
  hasTemplateSelected: boolean;
}

// ==================== AI PREFILL TYPES ====================

/**
 * Request body for AI form prefill
 */
export interface AIPrefillRequest {
  /** Form to generate fields for — an entity type or a declared assist-form id */
  formType: string;
  /** User's natural language description */
  description: string;
  /** Any fields already filled (to preserve user input) */
  existingData?: Record<string, unknown>;
}

/**
 * Confidence score for an AI-generated field (0-1)
 */
export type FieldConfidence = number;

/**
 * Response from AI form prefill
 */
export interface AIPrefillResponse {
  /** Whether the prefill was successful */
  success: boolean;
  /** Full set of form values to apply */
  data: Record<string, unknown>;
  /**
   * Fields the AI actually changed. Everything else in `data` is the user's
   * own value carried through, so only these should be flagged as AI-written.
   */
  changedFields?: string[];
  /** Confidence scores for each changed field (0-1) */
  confidence: Record<string, FieldConfidence>;
  /**
   * Why it failed, as a code the UI resolves into copy + a fix link via
   * @/config/ai-errors. Absent for validation feedback ("describe the change
   * you want"), which is guidance the user can act on as written, not a
   * failure needing a fix link.
   */
  code?: AiErrorCode;
  /** Raw message. Carried into a bug report; not rendered when `code` is set. */
  error?: string;
}

/**
 * Tracks which fields were AI-generated for visual indication
 */
export interface AIGeneratedFields {
  /** Set of field names that were AI-generated */
  fields: Set<string>;
  /** Confidence levels for each field */
  confidence: Record<string, FieldConfidence>;
}

/**
 * Props for the AI prefill bar component
 */
export interface AIPrefillBarProps {
  /** Form being filled — an entity type or a declared assist-form id (task, proposal) */
  formType: string;
  /** Callback when AI generates field values */
  onPrefill: (
    data: Record<string, unknown>,
    confidence: Record<string, FieldConfidence>,
    changedFields: string[]
  ) => void;
  /** Whether form is currently submitting */
  disabled?: boolean;
  /** Existing form data (to preserve user input) */
  existingData?: Record<string, unknown>;
  /**
   * Form mode — drives the copy. `create` (default) frames it as "describe
   * what you want and AI fills the form"; `edit` frames it as "describe the
   * change you want" since the fields are already populated.
   */
  mode?: 'create' | 'edit';
  /**
   * The form's own fields. Drives which one-click adjustments are offered, so
   * the bar suggests things this specific form can actually do (see
   * `getAdjustmentsForFields`) and can name changed fields by their label.
   */
  fields?: Array<Pick<FieldConfig, 'name' | 'label' | 'type'>>;
}

/**
 * State for AI prefill in entity form
 */
export interface AIPrefillState {
  /** Whether AI prefill is in progress */
  isGenerating: boolean;
  /** Fields that were AI-generated */
  aiGeneratedFields: AIGeneratedFields;
  /** Last error if any */
  error?: string;
}
