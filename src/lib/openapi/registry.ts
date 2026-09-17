/**
 * OpenAPI registry — the single place Zod-to-OpenAPI is activated.
 *
 * Importing this file calls extendZodWithOpenApi(z), which attaches the
 * `.openapi()` chain method to every Zod schema. The registry it exports
 * is shared by every site that wants to register a schema for inclusion
 * in /api/v1/openapi.json.
 *
 * Created: 2026-06-03
 * Last Modified: 2026-06-03
 * Last Modified Summary: Initial implementation — machine-readable v1 contract for Loki + future SDK consumers.
 */

import { z } from 'zod';
import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// Run-once side effect — must happen before any schema is given .openapi() metadata.
extendZodWithOpenApi(z);

/**
 * The single registry. Adding routes / schemas anywhere in the codebase
 * MUST go through this — multiple registries would produce conflicting
 * specs.
 */
export const openApiRegistry = new OpenAPIRegistry();
