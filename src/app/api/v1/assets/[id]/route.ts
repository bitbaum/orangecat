/**
 * Public API — GET /api/v1/assets/[id]
 *
 * See /api/v1/README.md for the v1 contract. This file uses the
 * shared GET-by-id handler factory; integration-key auth + scopes +
 * is_test filtering all live there.
 */

import { createEntityGetByIdHandler } from '@/lib/api/entityGetByIdHandler';

export const GET = createEntityGetByIdHandler({ entityType: 'asset' });

// PUT — update an existing asset (integration key or session). Used by
// Loki to keep robot book/rent/sell flags in sync after first publish.
export { PUT } from '@/app/api/assets/[id]/route';
