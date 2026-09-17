/**
 * Form Prefill Service
 *
 * Core service for AI-powered form prefill functionality.
 * Processes natural language descriptions and generates structured form data.
 */

import type { AIPrefillResponse } from '@/components/create/types';
import { callPlatformJson, hasPlatformProviders } from '@/services/cat/platform-llm';
import {
  AI_ASSIST_MIN_INPUT_LENGTH,
  USER_OVERRIDABLE_FIELDS,
  type AiAssistIntent,
} from '@/config/ai-form-assist';
import { logger } from '@/utils/logger';
import { extractFieldDescriptions, formatFieldsForPrompt } from './schema-to-prompt';
import { getSystemPrompt, getUserPrompt, parseAIResponse } from './prompts/form-prefill';
import { sanitizeAiFields } from './sanitize-ai-fields';
import type { AiAssistTarget } from './assist-target';

/**
 * Configuration for the form prefill service
 */
interface FormPrefillConfig {
  /** Maximum tokens for AI response */
  maxTokens?: number;
  /** Temperature for generation (lower = more deterministic) */
  temperature?: number;
}

export interface FormPrefillRequest {
  /** What form is being filled — resolve via `resolveAiAssistTarget` */
  target: AiAssistTarget;
  /** What the user typed: a description to fill from, or a change to apply */
  description: string;
  /** Current form values */
  existingData?: Record<string, unknown>;
  /** Fill an empty form, or revise the values already in it. Default `fill`. */
  intent?: AiAssistIntent;
  /** Generation overrides */
  config?: FormPrefillConfig;
}

/**
 * Decide the final form values, and report which fields actually changed.
 *
 * This is the SSOT for "who wins on conflict", and it is why refinement used
 * to silently do nothing: existing values unconditionally overwrote the AI's
 * output, so a request to rewrite a non-empty description could never take
 * effect.
 *
 * - `fill`   — the user's own input is protected; the AI only lands in gaps
 *   (plus the price/currency fields, which carry template defaults rather than
 *   user intent — see USER_OVERRIDABLE_FIELDS).
 * - `refine` — the AI wins for the fields it returns, since changing them is
 *   the entire request. Fields it omits keep their current values.
 */
export function mergePrefillResult(
  aiData: Record<string, unknown>,
  existingData: Record<string, unknown> | undefined,
  intent: AiAssistIntent
): { data: Record<string, unknown>; changedFields: string[] } {
  const existing = existingData ?? {};

  if (intent === 'refine') {
    const changedFields = Object.keys(aiData).filter(
      key => !valuesEqual(aiData[key], existing[key])
    );
    return { data: { ...existing, ...aiData }, changedFields };
  }

  const data: Record<string, unknown> = { ...aiData };
  for (const [key, value] of Object.entries(existing)) {
    const userProvided = value !== '' && value !== null && value !== undefined;
    if (userProvided && !USER_OVERRIDABLE_FIELDS.includes(key)) {
      data[key] = value;
    }
  }
  const changedFields = Object.keys(aiData).filter(key => !valuesEqual(data[key], existing[key]));
  return { data, changedFields };
}

/** Structural equality good enough for form values (scalars, arrays, plain objects). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Server-side form prefill service
 *
 * This should be called from an API route, not directly from the client.
 */
export async function generateFormPrefill({
  target,
  description,
  existingData,
  intent = 'fill',
  config,
}: FormPrefillRequest): Promise<AIPrefillResponse> {
  // Same per-intent floor as the API schema (AI_ASSIST_MIN_INPUT_LENGTH) — a
  // hardcoded 10 here used to reject the short refine instructions ("shorter")
  // the route had just accepted.
  const minLength = AI_ASSIST_MIN_INPUT_LENGTH[intent];
  if (!description || description.trim().length < minLength) {
    return {
      success: false,
      data: {},
      confidence: {},
      error:
        intent === 'refine'
          ? `Describe the change you want (at least ${minLength} characters)`
          : `Please provide a longer description (at least ${minLength} characters)`,
    };
  }

  try {
    // Describe the declared fields for the prompt
    const fieldDescriptions = extractFieldDescriptions(target.fields);
    const fieldsPrompt = formatFieldsForPrompt(fieldDescriptions);
    const specialInstructions = target.instructions.join('\n');

    // Build prompts
    const systemPrompt = getSystemPrompt(target.name, intent);
    const userPrompt = getUserPrompt(
      target.name,
      description,
      fieldsPrompt,
      specialInstructions,
      existingData,
      intent
    );

    if (!hasPlatformProviders()) {
      return {
        success: false,
        data: {},
        confidence: {},
        code: 'provider_not_configured',
        error: 'AI provider not configured. Please set up an API key in settings.',
      };
    }

    // Transport goes through the shared platform chain (Groq, then OpenRouter),
    // NOT a hand-rolled fetch. This file used to pick ONE provider by key
    // presence and stop — so when Groq retired the llama-3.x family, "Fill with
    // AI" failed for every user while a configured OpenRouter key sat unused
    // (reproduced in production 2026-08-25). platform-llm was repaired for
    // exactly that failure mode on 2026-08-26; this call makes prefill ride the
    // same chain instead of re-living the outage on the next model retirement
    // or Groq daily-cap 429.
    const aiContent = await callPlatformJson(systemPrompt, userPrompt, {
      temperature: config?.temperature ?? 0.3,
      // Headroom for genuinely written descriptions (and bilingual ones) —
      // 1000 truncated the JSON mid-string on multi-field forms.
      maxTokens: config?.maxTokens ?? 2000,
      // A person is waiting behind the Fill button; the free pool has no
      // latency guarantee, so cap each provider attempt rather than hang.
      timeoutMs: 30_000,
    });

    if (!aiContent) {
      return {
        success: false,
        data: {},
        confidence: {},
        code: 'provider_unavailable',
        error: 'AI service temporarily unavailable. Please try again.',
      };
    }

    // Parse the AI response
    const parsed = parseAIResponse(aiContent);
    if (!parsed) {
      return {
        success: false,
        data: {},
        confidence: {},
        code: 'unparseable_response',
        error: 'Could not parse AI response. Please try with a clearer description.',
      };
    }

    // Enforce declared field types before merging — the prompt asks for option
    // values / numbers / ISO dates, the sanitizer guarantees them.
    const aiData = sanitizeAiFields(parsed.data, target.fields, description);

    const { data, changedFields } = mergePrefillResult(aiData, existingData, intent);

    // Confidence is reported only for fields the AI actually changed — a
    // preserved value is the user's, not an AI guess, and marking it 1.0 made
    // the form highlight untouched fields as AI-generated.
    const confidence = Object.fromEntries(
      changedFields.map(field => [field, parsed.confidence[field] ?? 0.7])
    );

    return {
      success: true,
      data,
      changedFields,
      confidence,
    };
  } catch (error) {
    logger.error('Form prefill error', error, 'AI');
    return {
      success: false,
      data: {},
      confidence: {},
      code: 'unknown',
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
