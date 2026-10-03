/**
 * /api/v1/openapi.json answered 500 in production on 2026-10-03 with
 * "externalPublishSchema.openapi is not a function". With zod 4, a schema built
 * before extendZodWithOpenApi runs never gets `.openapi`, and the production
 * bundle happened to evaluate config/external-publish first. These imports
 * reproduce that order on purpose — keep them above the generator import.
 */
import '@/config/external-publish';
import '@/config/stakeholders';
import { describe, expect, it } from 'vitest';
import { getOpenApiSpec } from '@/lib/openapi/generator';

describe('OpenAPI spec — import order', () => {
  it('builds even when imported schemas were constructed before the zod extension', () => {
    const spec = getOpenApiSpec() as { components?: { schemas?: Record<string, unknown> } };
    const schemas = spec.components?.schemas ?? {};
    expect(schemas).toHaveProperty('TimelinePublish');
    expect(schemas).toHaveProperty('StakeholderCreate');
  });
});
