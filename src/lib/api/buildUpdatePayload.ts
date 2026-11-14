/**
 * Generic Update Payload Builder
 *
 * Eliminates duplication in buildUpdatePayload functions across entity routes.
 * Provides utilities for building update payloads with defaults and field mapping.
 *
 * Created: 2025-12-27
 * Last Modified: 2026-01-04
 * Last Modified Summary: Added empty string normalization and common transforms
 */

import { entityTransforms } from './normalizeEntityData';

/**
 * Field mapping configuration for building update payloads
 */
interface FieldMapping {
  /** Source field name (from validated data) */
  from: string;
  /** Target field name (in update payload) - defaults to same as source */
  to?: string;
  /** Default value if source is undefined/null */
  default?: unknown;
  /** Transform function to apply to the value */
  transform?: (value: unknown) => unknown;
  /**
   * An explicit null (or '') in the data clears the column. Without it a null
   * is skipped, which is right for a partial update and wrong for a picture
   * someone just removed.
   */
  clearable?: boolean;
}

/**
 * Build update payload from validated data using field mappings
 *
 * @param data - Validated entity data
 * @param mappings - Field mappings configuration
 * @param options - Additional options
 * @returns Update payload object
 *
 * @example
 * ```typescript
 * const payload = buildUpdatePayload(data, [
 *   { from: 'title' },
 *   { from: 'price' },
 *   { from: 'currency', default: 'CHF' },
 *   { from: 'product_type', default: 'physical' },
 *   { from: 'images', default: [] },
 * ]);
 * ```
 */
export function buildUpdatePayload(
  data: Record<string, unknown>,
  mappings: FieldMapping[],
  options?: {
    /** Include fields that are undefined/null (default: false) */
    includeUndefined?: boolean;
    /** Additional fields to include (merged after mappings) */
    additionalFields?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const sourceValue = data[mapping.from];
    const targetKey = mapping.to ?? mapping.from;

    if (mapping.clearable && (sourceValue === null || sourceValue === '')) {
      payload[targetKey] = null;
      continue;
    }

    // Normalize empty strings to null for optional fields (unless transform handles it)
    // This prevents database constraint violations for UUID, URL, and other fields
    let normalizedValue = sourceValue;
    if (typeof sourceValue === 'string' && sourceValue === '' && !mapping.transform) {
      normalizedValue = null;
    }

    // Skip if undefined/null and not including undefined
    if (!options?.includeUndefined && (normalizedValue === undefined || normalizedValue === null)) {
      // Use default if provided
      if (mapping.default !== undefined) {
        payload[targetKey] = mapping.default;
      }
      continue;
    }

    // Use value, default, or undefined
    let value =
      normalizedValue !== undefined && normalizedValue !== null ? normalizedValue : mapping.default;

    // Apply transform if provided (transforms can override empty string handling)
    if (value !== undefined && mapping.transform) {
      value = mapping.transform(value);
    }

    // Only include if value is defined (or includeUndefined is true)
    if (value !== undefined || options?.includeUndefined) {
      payload[targetKey] = value;
    }
  }

  // Merge additional fields
  if (options?.additionalFields) {
    Object.assign(payload, options.additionalFields);
  }

  return payload;
}

/**
 * Helper to create a buildUpdatePayload function for an entity
 *
 * @param mappings - Field mappings configuration
 * @returns buildUpdatePayload function
 *
 * @example
 * ```typescript
 * const buildProductUpdatePayload = createUpdatePayloadBuilder([
 *   { from: 'title' },
 *   { from: 'price' },
 *   { from: 'currency', default: 'CHF' },
 *   { from: 'thumbnail_url', transform: entityTransforms.normalizeURL },
 * ]);
 * ```
 */
export function createUpdatePayloadBuilder(mappings: FieldMapping[]) {
  return (data: Record<string, unknown>, options?: Parameters<typeof buildUpdatePayload>[2]) => {
    return buildUpdatePayload(data, mappings, options);
  };
}

/**
 * Common field mappings with transforms for reuse across entities
 */
export const commonFieldMappings = {
  /** URL fields that should normalize empty strings to null */
  urlField: (fieldName: string): FieldMapping => ({
    from: fieldName,
    transform: entityTransforms.normalizeURL,
  }),

  /** UUID fields that should normalize empty strings to null */
  uuidField: (fieldName: string): FieldMapping => ({
    from: fieldName,
    transform: entityTransforms.normalizeUUID,
  }),

  /** Array fields that should normalize null to empty array */
  arrayField: (fieldName: string, defaultValue: unknown[] = []): FieldMapping => ({
    from: fieldName,
    default: defaultValue,
    transform: entityTransforms.nullToEmptyArray,
  }),

  /** Date fields that should be normalized to ISO strings */
  dateField: (fieldName: string): FieldMapping => ({
    from: fieldName,
    transform: entityTransforms.normalizeDate,
  }),

  /** Optional string fields that should normalize empty strings to null */
  optionalStringField: (fieldName: string): FieldMapping => ({
    from: fieldName,
    transform: entityTransforms.emptyStringToNull,
  }),
};

// Re-export transforms for convenience
export { entityTransforms };
