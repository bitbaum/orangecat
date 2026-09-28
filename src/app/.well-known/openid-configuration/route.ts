/**
 * OIDC discovery document.
 *
 * GET /.well-known/openid-configuration — lets relying parties (Loki's
 * Auth.js generic OIDC provider, etc.) auto-configure. The document itself is
 * built once in src/lib/oauth/metadata.ts and also served at RFC 8414's
 * /.well-known/oauth-authorization-server for MCP clients.
 */
import {
  buildAuthorizationServerMetadata,
  corsPreflight,
  metadataResponse,
} from '@/lib/oauth/metadata';

// Must read OAUTH_ISSUER from the runtime env (the box), not bake the build-time
// value — otherwise the advertised issuer/endpoints would be wrong in prod.
// Cached via Cache-Control; cheap and rarely hit.
export const dynamic = 'force-dynamic';

export function GET() {
  return metadataResponse(buildAuthorizationServerMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
