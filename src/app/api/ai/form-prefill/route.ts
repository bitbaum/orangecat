/**
 * AI Form Prefill API Endpoint
 *
 * Generates form field values from natural language descriptions using AI.
 * Serves every AI-assistable form: registry entities (product, service, …)
 * and standalone declared forms (task, proposal) — see
 * `resolveAiAssistTarget` for how a form type becomes a field list.
 *
 * POST /api/ai/form-prefill
 */

import { z } from 'zod';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import {
  apiSuccess,
  apiError,
  apiBadRequest,
  apiValidationError,
  apiRateLimited,
  apiInternalError,
} from '@/lib/api/standardResponse';
import { generateFormPrefill } from '@/lib/ai/form-prefill-service';
import { resolveAiAssistTarget } from '@/lib/ai/assist-target';
import { logger } from '@/utils/logger';
import { rateLimitWriteAsync, retryAfterSeconds } from '@/lib/rate-limit';
import { AI_ASSIST_MIN_INPUT_LENGTH } from '@/config/ai-form-assist';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * Request validation schema
 */
const requestSchema = z
  .object({
    /** Entity type or standalone assist-form id ("service", "task", …) */
    formType: z.string().min(1).optional(),
    /** Legacy name for formType — kept so in-flight clients keep working */
    entityType: z.string().min(1).optional(),
    description: z.string().min(1, 'Description is required'),
    existingData: z.record(z.string(), z.unknown()).optional(),
    /**
     * `fill` protects what the user already typed; `refine` lets the AI rewrite
     * it. A refine request that arrives as `fill` can never change anything.
     */
    intent: z.enum(['fill', 'refine']).default('fill'),
  })
  .refine(body => body.formType || body.entityType, {
    message: 'formType is required',
    path: ['formType'],
  })
  // The floor depends on the intent — a refinement is an instruction, not a
  // description, and "shorter" says everything it needs to in seven characters.
  .superRefine((value, ctx) => {
    const min = AI_ASSIST_MIN_INPUT_LENGTH[value.intent];
    if (value.description.trim().length < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['description'],
        message:
          value.intent === 'refine'
            ? `Describe the change you want (at least ${min} characters)`
            : `Description must be at least ${min} characters`,
      });
    }
  });

/**
 * POST /api/ai/form-prefill
 *
 * Generate form field values from a natural language description.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { user } = req;

  const rl = await rateLimitWriteAsync(user.id);
  if (!rl.success) {
    const retryAfter = retryAfterSeconds(rl);
    logger.warn('Rate limit exceeded for AI form prefill', { userId: user.id }, 'AI');
    return apiRateLimited('Too many requests. Please slow down.', retryAfter);
  }

  try {
    // Parse and validate request body
    const body = await req.json();
    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      return apiValidationError('Invalid request', parseResult.error.flatten().fieldErrors);
    }

    const { description, existingData, intent } = parseResult.data;
    const formType = parseResult.data.formType ?? parseResult.data.entityType ?? '';

    const target = resolveAiAssistTarget(formType);
    if (!target) {
      return apiBadRequest(`Unknown form type: ${formType}`);
    }

    logger.info(
      'AI form prefill request',
      {
        userId: user.id,
        formType,
        intent,
        descriptionLength: description.length,
      },
      'AI'
    );

    // Generate form prefill using AI
    const result = await generateFormPrefill({
      target,
      description,
      existingData,
      intent,
    });

    if (!result.success) {
      logger.warn(
        'AI form prefill failed',
        {
          userId: user.id,
          formType,
          error: result.error,
        },
        'AI'
      );

      // The code, not the prose, is what the client renders from — apiError
      // puts it on error.code, where unwrapApiResponse picks it up.
      return apiError(
        apiErrorMessage(result, 'Failed to generate form data'),
        result.code ?? 'unknown',
        400
      );
    }

    logger.info(
      'AI form prefill success',
      {
        userId: user.id,
        formType,
        intent,
        fieldsChanged: result.changedFields?.length ?? 0,
      },
      'AI'
    );

    // Standard envelope — AIPrefillBar unwraps and reads data/changedFields/confidence.
    return apiSuccess({
      data: result.data,
      changedFields: result.changedFields ?? [],
      confidence: result.confidence,
    });
  } catch (error) {
    logger.error(
      'AI form prefill error',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      'AI'
    );

    return apiInternalError('An unexpected error occurred while generating form data');
  }
});
