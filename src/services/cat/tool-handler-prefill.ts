/**
 * prefill_entity_form — the Cat drafts an entity and the person gets a card
 * to review, edit and publish in the chat. Split out of tool-executor.ts
 * (500-line service limit) along the seam the other tool handlers use.
 *
 * An event's draft is special-cased: its model needs to know what day it is
 * and where the person is, or "today 19:00" cannot become a date — and a
 * model told never to invent one leaves the field out, so Publish failed on
 * "Start date is required". The same facts then make the draft valid
 * (event-draft.ts).
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { generateFormPrefill } from '@/lib/ai/form-prefill-service';
import { resolveAiAssistTarget } from '@/lib/ai/assist-target';
import { isValidEntityType, type EntityType } from '@/config/entity-registry';
import { getProfileCurrency } from '@/services/currency/profileCurrency';
import { getProfileTimezone } from '@/services/profile/profileTimezone';
import { PREFILLABLE_ENTITY_TYPES } from './tool-use-detection';
import { normalizeEventDraft, withEventDayContext } from './event-draft';
import type {
  OnPrefillProposal,
  OnToolCall,
  RawToolCall,
  ToolResultMessage,
} from './tool-use-types';

export async function handlePrefillEntityForm(
  supabase: AnySupabaseClient,
  userId: string,
  toolCall: RawToolCall,
  onToolCall?: OnToolCall,
  onPrefillProposal?: OnPrefillProposal
): Promise<ToolResultMessage> {
  const toolName = toolCall.function.name;
  const parsedArgs = (() => {
    try {
      return JSON.parse(toolCall.function.arguments ?? '{}') as {
        entityType?: string;
        description?: string;
      };
    } catch {
      return {} as { entityType?: string; description?: string };
    }
  })();

  const requestedType = parsedArgs.entityType ?? '';
  const description = parsedArgs.description ?? '';

  onToolCall?.({
    id: toolCall.id,
    name: toolName,
    status: 'running',
    args: { entityType: requestedType },
  });

  if (!isValidEntityType(requestedType)) {
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'failed',
      error: 'invalid_entity_type',
    });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Invalid entityType "${requestedType}". Pick one of: ${PREFILLABLE_ENTITY_TYPES.join(', ')}.`,
    };
  }

  const entityType = requestedType as EntityType;
  const target = resolveAiAssistTarget(entityType);
  if (!target) {
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'failed',
      error: 'no_entity_config',
    });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `No config for entity type "${entityType}". Skip prefill.`,
    };
  }

  try {
    const eventCtx =
      entityType === 'event'
        ? await Promise.all([
            getProfileTimezone(supabase, userId).catch(() => null),
            getProfileCurrency(supabase, userId),
          ]).then(([zone, currency]) => ({ now: new Date(), zone: zone ?? 'UTC', currency }))
        : null;
    const prefill = await generateFormPrefill({
      target,
      description: eventCtx ? withEventDayContext(description, eventCtx) : description,
    });
    if (!prefill.success) {
      onToolCall?.({
        id: toolCall.id,
        name: toolName,
        status: 'failed',
        error: prefill.error ?? 'unknown',
      });
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `Prefill failed: ${prefill.error ?? 'unknown error'}`,
      };
    }

    const fieldCount = Object.keys(prefill.data).length;
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'completed',
      resultCount: fieldCount,
      results: [],
    });
    const data = prefill.data as Record<string, unknown>;
    onPrefillProposal?.({
      entityType,
      sourceDescription: description,
      data: eventCtx ? normalizeEventDraft(data, eventCtx) : data,
      confidence: prefill.confidence as Record<string, number>,
    });
    return {
      role: 'tool',
      tool_call_id: toolCall.id,
      content: `Drafted a ${entityType} with ${fieldCount} fields. The user will see a card to review and open in the form. Do not repeat the field values in your response — briefly confirm what you drafted, include ONE short line on why a ${entityType} is the right type for it (tied to the user's own words), and invite them to review. Do NOT call prefill_entity_form again for this same ${entityType} — it is already drafted.`,
    };
  } catch (err) {
    onToolCall?.({
      id: toolCall.id,
      name: toolName,
      status: 'failed',
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { role: 'tool', tool_call_id: toolCall.id, content: 'Prefill failed unexpectedly.' };
  }
}
