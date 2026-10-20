/**
 * DOCUMENT DOMAIN SERVICE
 *
 * Business logic for user documents (My Cat context).
 * Documents provide personal context that My Cat can use to give personalized advice.
 *
 * Created: 2026-01-20
 * Last Modified: 2026-03-31
 * Last Modified Summary: Refactored to use generic base entity service for CRUD
 */

import {
  withResolvedActor,
  listEntityPage,
  getEntity as baseGetEntity,
  createEntity,
  updateEntity,
  deleteEntity,
} from '@/domain/base/entityService';
import type { DocumentFormData, DocumentVisibility, DocumentType } from '@/lib/validation';

export interface Document {
  id: string;
  actor_id: string;
  title: string;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  document_type: DocumentType;
  visibility: DocumentVisibility;
  tags: string[];
  summary: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List documents for a user with pagination
 */
export async function listDocumentsPage(
  limit: number,
  offset: number,
  userId?: string,
  filters?: {
    document_type?: DocumentType;
    visibility?: DocumentVisibility;
  }
) {
  const eqFilters: Record<string, unknown> = {};
  if (filters?.document_type) {
    eqFilters.document_type = filters.document_type;
  }
  if (filters?.visibility) {
    eqFilters.visibility = filters.visibility;
  }

  return listEntityPage<Document>('document', {
    limit,
    offset,
    userId,
    includeOwnDrafts: true,
    filters: eqFilters,
  });
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  return baseGetEntity<Document>('document', id);
}

/**
 * Create a new document
 */
export async function createDocument(userId: string, data: DocumentFormData): Promise<Document> {
  return createEntity<Document>(
    'document',
    userId,
    withResolvedActor(data, {
      title: data.title,
      content: data.content,
      document_type: data.document_type || 'notes',
      visibility: data.visibility || 'cat_visible',
      tags: data.tags || [],
    })
  );
}

/**
 * Update a document
 */
export async function updateDocument(
  id: string,
  userId: string,
  data: Partial<DocumentFormData>
): Promise<Document> {
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.content !== undefined) {
    updateData.content = data.content;
  }
  if (data.document_type !== undefined) {
    updateData.document_type = data.document_type;
  }
  if (data.visibility !== undefined) {
    updateData.visibility = data.visibility;
  }
  if (data.tags !== undefined) {
    updateData.tags = data.tags;
  }

  return updateEntity<Document>('document', id, userId, updateData);
}

/**
 * Delete a document
 */
export async function deleteDocument(id: string, userId: string): Promise<void> {
  return deleteEntity('document', id, userId);
}
