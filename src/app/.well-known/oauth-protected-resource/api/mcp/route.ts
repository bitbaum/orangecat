/**
 * RFC 9728 §3.1 path-suffixed form of the protected-resource metadata for
 * `${OAUTH_ISSUER}/api/mcp`. Same document as the bare path.
 */
import {
  buildProtectedResourceMetadata,
  corsPreflight,
  metadataResponse,
} from '@/lib/oauth/metadata';

// Segment config must be a literal in each route file, so it is not re-exported.
export const dynamic = 'force-dynamic';

export function GET() {
  return metadataResponse(buildProtectedResourceMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
