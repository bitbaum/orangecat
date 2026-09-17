/**
 * DOCUMENT [ID] API ROUTE
 *
 * Handles getting, updating, and deleting a single document.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-01-20
 * Last Modified Summary: Initial creation
 */

import { NextRequest } from 'next/server';
import { compose } from '@/lib/api/compose';
import { withRateLimit } from '@/lib/api/withRateLimit';
import { withRequestId } from '@/lib/api/withRequestId';
import { documentSchema } from '@/lib/validation';
import {
  handleApiError,
  apiSuccess,
  apiNotFound,
  apiValidationError,
} from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getDocument, updateDocument, deleteDocument } from '@/domain/documents/service';
import { validateUUID, getValidationError } from '@/lib/api/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id] - Get a single document (public, no auth required)
export const GET = compose(
  withRequestId(),
  withRateLimit('read')
)(async (_request: NextRequest, context: RouteContext) => {
  try {
    const { id } = await context.params;
    const idValidation = getValidationError(validateUUID(id, 'document ID'));
    if (idValidation) {
      return idValidation;
    }

    const document = await getDocument(id);
    if (!document) {
      return apiNotFound('Document');
    }

    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error);
  }
});

// PUT /api/documents/[id] - Update a document
export const PUT = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'document ID'));
  if (idValidation) {
    return idValidation;
  }
  const { user } = request;
  try {
    const body = await (request as NextRequest).json();

    // Validate input (partial schema)
    const result = documentSchema.partial().safeParse(body);
    if (!result.success) {
      return apiValidationError('Invalid document data', { details: result.error.issues });
    }

    const document = await updateDocument(id, user.id, result.data);
    return apiSuccess(document);
  } catch (error) {
    return handleApiError(error);
  }
});

// DELETE /api/documents/[id] - Delete a document
export const DELETE = withAuth(async (request: AuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const idValidation = getValidationError(validateUUID(id, 'document ID'));
  if (idValidation) {
    return idValidation;
  }
  const { user } = request;
  try {
    await deleteDocument(id, user.id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
});
