/**
 * RFC 9728 protected-resource metadata for OrangeCat's MCP server.
 *
 * GET /.well-known/oauth-protected-resource — named in the WWW-Authenticate
 * header /api/mcp sends with a 401, and so the first thing an MCP client reads.
 * Also served at the path-suffixed form (…/oauth-protected-resource/api/mcp),
 * which RFC 9728 §3.1 has clients derive from the resource URL.
 */
import {
  buildProtectedResourceMetadata,
  corsPreflight,
  metadataResponse,
} from '@/lib/oauth/metadata';

export const dynamic = 'force-dynamic';

export function GET() {
  return metadataResponse(buildProtectedResourceMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
