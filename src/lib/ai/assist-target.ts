/**
 * AI assist target resolution — the one place a form id becomes "what the AI
 * may write to".
 *
 * A form type is either an EntityType (fields come from the entity config's
 * fieldGroups) or a standalone form declared in `@/config/ai-assist-forms`
 * (tasks, proposals). Everything downstream — prompts, sanitizing, merging —
 * works off the resolved target and never needs to know which kind it was.
 */

import { getEntityConfig } from '@/config/entity-configs/get-config';
import { isValidEntityType, ENTITY_REGISTRY } from '@/config/entity-registry';
import { getAssistFormConfig } from '@/config/ai-assist-forms';
import { AI_ENTITY_INSTRUCTIONS, AI_UNIVERSAL_INSTRUCTIONS } from '@/config/ai-form-assist';
import type { FieldConfig } from '@/components/create/types';

export interface AiAssistTarget {
  /** The form id this resolved from (an EntityType or an assist-form id) */
  id: string;
  /** Human name used in prompts ("Service", "Task", "Proposal") */
  name: string;
  /** Fields the AI may write to */
  fields: FieldConfig[];
  /** Complete prompt instructions: universal rules + form-specific ones */
  instructions: string[];
}

/** The form field a photo goes into for this entity type, if it has one. */
export function imageFieldOf(formType: string): string | null {
  if (!isValidEntityType(formType)) {
    return null;
  }
  const field = getEntityConfig(formType)
    ?.fieldGroups.flatMap(group => group.fields ?? [])
    .find(f => f.type === 'image');
  return field?.name ?? null;
}

export function resolveAiAssistTarget(formType: string): AiAssistTarget | null {
  if (isValidEntityType(formType)) {
    const entityConfig = getEntityConfig(formType);
    if (!entityConfig) {
      return null;
    }
    return {
      id: formType,
      name: ENTITY_REGISTRY[formType].name,
      // Never an image field: a model asked for one writes a plausible URL to
      // a picture that does not exist. A photo comes only from a real upload
      // (imageFieldOf + the chat's stored photo).
      fields: entityConfig.fieldGroups
        .flatMap(group => group.fields ?? [])
        .filter(f => f.type !== 'image'),
      instructions: [...AI_UNIVERSAL_INSTRUCTIONS, ...(AI_ENTITY_INSTRUCTIONS[formType] ?? [])],
    };
  }

  const form = getAssistFormConfig(formType);
  if (!form) {
    return null;
  }
  return {
    id: formType,
    name: form.name,
    fields: form.fields,
    instructions: [...AI_UNIVERSAL_INSTRUCTIONS, ...(form.instructions ?? [])],
  };
}
