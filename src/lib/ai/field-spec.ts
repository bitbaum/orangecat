/**
 * OrangeCat's form fields, in the shape the fleet's form filler reads.
 *
 * `ai-forms` (via `@bitbaum/ai-kit/forms`) is the engine behind "Fill with
 * AI": it describes fields to the model, coerces what comes back to the
 * declared types, and decides who wins when the model and the person
 * disagree. It reads a `FieldSpec`; the create forms declare a `FieldConfig`.
 * This is the one translation between the two, so a field type added to the
 * forms is mapped here once and nowhere else.
 */

import type { FieldSpec, FieldType } from '@bitbaum/ai-kit/forms';
import { USER_OVERRIDABLE_FIELDS } from '@/config/ai-form-assist';
import type { FieldConfig, FieldInputType } from '@/components/create/types';

/**
 * What the model may write for each input type. A type the package does not
 * know is free text with a hint saying what shape the text takes — a
 * wall-clock datetime is NOT a package `date` (that would be read back as a
 * calendar day and lose the 19:00).
 */
const FIELD_TYPE: Record<FieldInputType, { type: FieldType; hint?: string; example?: string }> = {
  text: { type: 'text' },
  textarea: { type: 'textarea' },
  number: { type: 'number' },
  select: { type: 'select' },
  radio: { type: 'select' },
  checkbox: { type: 'boolean' },
  boolean: { type: 'boolean' },
  date: { type: 'date' },
  datetime: {
    type: 'text',
    hint: 'wall-clock date and time, YYYY-MM-DDTHH:mm, no zone suffix',
    example: '2026-12-25T19:00',
  },
  url: { type: 'url' },
  email: { type: 'email' },
  phone: { type: 'text', hint: 'phone number with country code', example: '+41 79 000 00 00' },
  currency: {
    type: 'number',
    hint: 'positive decimal amount in the unit named by the currency field (BTC or fiat units)',
    example: '25.99',
  },
  bitcoin_address: {
    type: 'text',
    hint: 'Bitcoin address, only if the user gave one',
    example: 'bc1q…',
  },
  tags: { type: 'tags' },
  availability: { type: 'text' },
  // A model asked for a picture writes a plausible URL to one that does not
  // exist. Photos come only from a real upload.
  image: { type: 'text' },
};

function joinHints(...parts: Array<string | undefined>): string | undefined {
  const hint = parts.filter(Boolean).join(' — ');
  return hint || undefined;
}

export function toFieldSpec(field: FieldConfig): FieldSpec {
  const mapped = FIELD_TYPE[field.type];
  return {
    name: field.name,
    label: field.label,
    type: mapped.type,
    required: field.required,
    hint: joinHints(field.hint, mapped.hint),
    placeholder: field.placeholder ?? mapped.example,
    options: field.options?.map(o => ({ value: o.value, label: o.label })),
    min: field.min,
    max: field.max,
    aiExcluded: field.type === 'image',
    // A price or currency on a create form is a template default, not what
    // the person typed, so a fill may replace it — one list, read by the
    // prompt and the merge alike.
    overridable: USER_OVERRIDABLE_FIELDS.includes(field.name),
  };
}

export function toFieldSpecs(fields: readonly FieldConfig[]): FieldSpec[] {
  return fields.map(toFieldSpec);
}
