/**
 * Build the OpenAPI 3.1 document for the v1 public API.
 *
 * Lazy + memoised: the spec is the same for every request, so we
 * generate it once per process.
 *
 * Created: 2026-06-03
 */

import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { openApiRegistry } from './registry';
import { registerV1Routes } from './registerV1Routes';
import { PUBLIC_API_VERSION } from '@/config/public-api';
import { CONTACT_EMAIL } from '@/config/brand';

let memo: object | null = null;

export function getOpenApiSpec() {
  if (memo) {
    return memo;
  }
  registerV1Routes();
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);
  memo = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'OrangeCat Public API',
      version: PUBLIC_API_VERSION,
      description: `Authenticate sibling products and third-party integrations into OrangeCat with an integration key (see /settings/integrations). The v1 surface is the stable contract; non-versioned endpoints are internal and may change. Contact: ${CONTACT_EMAIL}.`,
      license: { name: 'MIT', url: 'https://github.com/bitbaum/orangecat/blob/main/LICENSE' },
    },
    servers: [
      { url: 'https://orangecat.ch', description: 'Production' },
      { url: 'http://localhost:3020', description: 'Local development' },
    ],
  });
  return memo;
}
