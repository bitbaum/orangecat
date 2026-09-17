/**
 * STANDARD API RESPONSE WRAPPER
 *
 * Provides consistent response format across all API endpoints
 * Part of Priority 0: Foundation improvements
 *
 * Created: 2025-10-23
 */

import { NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { CACHE_PRESETS } from './cache-policy';

// =====================================================================
// TYPES
// =====================================================================

interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata?: {
    timestamp: string;
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata?: {
    timestamp: string;
  };
}

// =====================================================================
// SUCCESS RESPONSES
// =====================================================================


/**
 * Create a successful API response with standard format
 */
export function apiSuccess<T>(
  data: T,
  options?: {
    page?: number;
    limit?: number;
    total?: number;
    status?: number;
    headers?: HeadersInit;
    cache?: string | keyof typeof CACHE_PRESETS;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const { status, headers, cache, ...metadata } = options || {};
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  // Build headers with cache control if specified
  const responseHeaders = new Headers(headers || {});

  if (cache) {
    const cacheValue =
      typeof cache === 'string' ? cache : CACHE_PRESETS[cache] || CACHE_PRESETS.NONE;
    responseHeaders.set('Cache-Control', cacheValue);
  }

  return NextResponse.json(response, {
    status: status || 200,
    headers: responseHeaders,
  });
}

/**
 * Create a paginated success response
 */
export function apiSuccessPaginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): NextResponse<ApiSuccessResponse<T[]>> {
  return apiSuccess(data, { page, limit, total });
}

/**
 * Create a 201 Created response
 */
export function apiCreated<T>(
  data: T,
  options?: {
    page?: number;
    limit?: number;
    total?: number;
    headers?: HeadersInit | Record<string, string>;
  }
): NextResponse<ApiSuccessResponse<T>> {
  const { headers, ...metadata } = options || {};
  const response: ApiSuccessResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      ...metadata,
    },
  };

  const responseHeaders = headers ? new Headers(headers as HeadersInit) : undefined;
  return NextResponse.json(response, { status: 201, headers: responseHeaders });
}

/**
 * Create a 204 No Content response
 */
export function apiNoContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

// =====================================================================
// ERROR RESPONSES
// =====================================================================

/**
 * Create a standardized error response
 */
export function apiError(
  message: string,
  code: string = 'INTERNAL_ERROR',
  status: number = 500,
  details?: unknown
): NextResponse<ApiErrorResponse> {
  const response: ApiErrorResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
    metadata: {
      timestamp: new Date().toISOString(),
    },
  };

  // Log error for monitoring
  logger.error(`API Error [${code}]: ${message}`, { details, status });

  return NextResponse.json(response, { status });
}

/**
 * 402 Payment Required — the HTTP-402/L402 machine-payment convention.
 * `details` carries the challenge (token, bolt11, amount…); `wwwAuthenticate`
 * sets the header wallets/agents parse. Not logged as an error: a 402 is the
 * protocol working, not a failure.
 */
export function apiPaymentRequired(
  message: string,
  details?: unknown,
  wwwAuthenticate?: string
): NextResponse<ApiErrorResponse> {
  const response = NextResponse.json<ApiErrorResponse>(
    {
      success: false,
      error: { code: 'PAYMENT_REQUIRED', message, details },
      metadata: { timestamp: new Date().toISOString() },
    },
    { status: 402 }
  );
  // The 402 body and the WWW-Authenticate header both carry the payment
  // token — a bearer credential for this intent. Every other payment response
  // sets no-store; this one did not, so a shared cache or an intermediary was
  // free to keep the credential and hand it to the next caller.
  response.headers.set('Cache-Control', CACHE_PRESETS.NONE);
  if (wwwAuthenticate) {
    response.headers.set('WWW-Authenticate', wwwAuthenticate);
  }
  return response;
}

/**
 * 400 Bad Request
 */
export function apiBadRequest(
  message: string = 'Bad request',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'BAD_REQUEST', 400, details);
}

/**
 * 401 Unauthorized
 */
export function apiUnauthorized(
  message: string = 'Unauthorized',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'UNAUTHORIZED', 401, details);
}

/**
 * 403 Forbidden
 */
export function apiForbidden(
  message: string = 'Forbidden',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'FORBIDDEN', 403, details);
}

/**
 * 404 Not Found
 */
export function apiNotFound(
  message: string = 'Not found',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'NOT_FOUND', 404, details);
}

/**
 * 409 Conflict
 */
export function apiConflict(
  message: string = 'Conflict',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'CONFLICT', 409, details);
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
export function apiValidationError(
  message: string = 'Validation failed',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'VALIDATION_ERROR', 422, details);
}

/**
 * 429 Too Many Requests
 */
export function apiRateLimited(
  message: string = 'Too many requests',
  retryAfter?: number
): NextResponse<ApiErrorResponse> {
  const response = apiError(message, 'RATE_LIMITED', 429, { retryAfter });

  if (retryAfter) {
    response.headers.set('Retry-After', retryAfter.toString());
  }

  return response;
}

/**
 * 500 Internal Server Error
 */
export function apiInternalError(
  message: string = 'Internal server error',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'INTERNAL_ERROR', 500, details);
}

/**
 * 503 Service Unavailable
 */
export function apiServiceUnavailable(
  message: string = 'Service unavailable',
  details?: unknown
): NextResponse<ApiErrorResponse> {
  return apiError(message, 'SERVICE_UNAVAILABLE', 503, details);
}

// =====================================================================
// UTILITY FUNCTIONS
// =====================================================================

type SupabaseError = { code?: string; message?: string; hint?: string };
type ZodLikeError = { issues?: Array<{ path?: Array<string | number>; message?: string }> };
type ApiLikeError = {
  name?: string;
  code?: string;
  hint?: string;
  status?: number;
  message?: string;
};

/**
 * Handle standard Supabase errors and convert to API responses
 */
export function handleSupabaseError(error: unknown): NextResponse<ApiErrorResponse> {
  logger.error('Supabase error', error);

  const err = error as SupabaseError;

  // Not found
  if (err.code === 'PGRST116') {
    return apiNotFound('Resource not found');
  }

  // Unique constraint violation
  if (err.code === '23505') {
    return apiConflict('Resource already exists');
  }

  // Foreign key violation
  if (err.code === '23503') {
    return apiBadRequest('Invalid reference');
  }

  // Row level security violation
  if (err.code === '42501' || err.message?.includes('row-level security')) {
    return apiForbidden('Access denied');
  }

  // Default to internal error — log details server-side, don't expose to client
  logger.error('Unhandled database error', {
    code: err.code,
    hint: err.hint,
    message: err.message,
  });
  return apiInternalError('Database error');
}

/**
 * Handle validation errors (Zod)
 */
export function handleValidationError(error: unknown): NextResponse<ApiErrorResponse> {
  const err = error as ZodLikeError;
  if (err.issues && Array.isArray(err.issues)) {
    return apiValidationError('Validation failed', {
      fields: err.issues.map(e => ({
        field: e.path?.join('.'),
        message: e.message,
      })),
    });
  }

  return apiBadRequest('Invalid input', error);
}

/**
 * Catch-all error handler
 */
export function handleApiError(error: unknown): NextResponse<ApiErrorResponse> {
  const err = error as ApiLikeError;

  // Validation errors (Zod)
  if (err.name === 'ZodError') {
    return handleValidationError(error);
  }

  // Supabase errors
  if (err.code || err.hint) {
    return handleSupabaseError(error);
  }

  // Custom error with status
  if (err.status && err.message) {
    return apiError(err.message, err.code || 'ERROR', err.status);
  }

  // Unknown error
  logger.error('Unhandled API error', error);
  return apiInternalError('An unexpected error occurred');
}
