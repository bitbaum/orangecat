/**
 * RFC 8414 authorization-server metadata.
 *
 * GET /.well-known/oauth-authorization-server — the address MCP clients
 * (claude.ai, ChatGPT, Claude Code) probe. Same document as the OIDC discovery
 * route; both come from buildAuthorizationServerMetadata.
 */
import {
  buildAuthorizationServerMetadata,
  corsPreflight,
  metadataResponse,
} from '@/lib/oauth/metadata';

export const dynamic = 'force-dynamic';

export function GET() {
  return metadataResponse(buildAuthorizationServerMetadata());
}

export function OPTIONS() {
  return corsPreflight();
}
