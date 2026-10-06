/**
 * GET /api/v1/openapi.json — the v1 OpenAPI 3.1 spec.
 *
 * Public, unauthenticated. The document describes only routes we promise
 * to keep working — leaking it doesn't leak anything that isn't already
 * the public contract.
 *
 * Cache-Control: 5 minutes — the spec is process-memoised, so this
 * mostly serves the browser/CDN tier.
 *
 * A failure answers with what failed. On 2026-10-03 production answered this
 * route with a bare 500 and an empty body while the same generator ran
 * cleanly everywhere else — the cause was unreadable from outside. The spec
 * is public, so the generator's own error message is too.
 */

import { NextResponse } from 'next/server';
import { getOpenApiSpec } from '@/lib/openapi/generator';
import { logger } from '@/utils/logger';

export async function GET() {
  try {
    return NextResponse.json(getOpenApiSpec(), {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    logger.error('openapi: spec generation failed', { error: detail }, 'OpenAPI');
    return NextResponse.json(
      { success: false, error: 'The API description could not be generated.', detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
