/**
 * Dynamic Client Registration (RFC 7591) — how an AI app becomes an OAuth client.
 *
 * claude.ai custom connectors, ChatGPT connectors, Claude Code and other MCP
 * clients register themselves before sending anyone to /oauth/authorize. Nobody
 * at OrangeCat reviews them, so everything here is shaped around that fact:
 *
 *  - Public clients only: no secret is issued, PKCE S256 is what binds a code
 *    to the app that asked for it (the authorize page already requires it).
 *  - Redirects are https, or http on the loopback interface (native apps such
 *    as Claude Code listen on localhost). Nothing else — no custom schemes, no
 *    fragments, no credentials in the URL.
 *  - Never trusted, never confidential: the consent screen always shows, says
 *    the app registered itself and is not verified, and names the host it will
 *    send the person back to. The person's consent is the gate, which is why
 *    the scope ceiling is every scope rather than a curated few.
 *  - Nothing the app says about itself is shown except a trimmed name. Logos
 *    and homepage URLs are phishing props, so they are ignored.
 */
import { randomBytes } from 'node:crypto';
import { DATABASE_TABLES } from '@/config/database-tables';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { OAUTH_CLIENT_ORIGINS, SUPPORTED_SCOPE_NAMES } from '@/lib/oauth/config';

export const DCR_LIMITS = {
  maxRedirectUris: 5,
  maxRedirectUriLength: 2000,
  maxClientNameLength: 80,
  defaultClientName: 'Unnamed app',
  clientIdPrefix: 'dcr_',
} as const;

const GRANT_TYPES = ['authorization_code', 'refresh_token'] as const;
const RESPONSE_TYPES = ['code'] as const;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface RegistrationMetadata {
  clientName: string;
  redirectUris: string[];
}

export type RegistrationValidation =
  | { ok: true; metadata: RegistrationMetadata }
  | {
      ok: false;
      error: 'invalid_redirect_uri' | 'invalid_client_metadata';
      description: string;
    };

/** https anywhere, or http on the loopback interface; no fragment, no userinfo. */
export function isAllowedRedirectUri(raw: string): boolean {
  if (raw.length > DCR_LIMITS.maxRedirectUriLength) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  // `new URL` drops an empty "#", so check the raw string as well.
  if (url.hash || raw.includes('#') || url.username || url.password) {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  return url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname);
}

/** Printable, single-line, bounded — this string is shown on the consent screen. */
function cleanClientName(raw: unknown): string {
  if (typeof raw !== 'string') {
    return DCR_LIMITS.defaultClientName;
  }
  // Control and bidi-override characters could make the name read as something
  // it is not; collapse them to spaces before trimming.
  const cleaned = raw
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, DCR_LIMITS.maxClientNameLength)
    .trim();
  return cleaned || DCR_LIMITS.defaultClientName;
}

function isSubsetOf(value: unknown, allowed: readonly string[]): boolean {
  return Array.isArray(value) && value.every(v => typeof v === 'string' && allowed.includes(v));
}

/** Validate an RFC 7591 registration request body. Pure — no I/O. */
export function validateRegistration(body: unknown): RegistrationValidation {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'expected a JSON object',
    };
  }
  const b = body as Record<string, unknown>;

  const uris = b.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description: 'redirect_uris must be a non-empty array',
    };
  }
  if (uris.length > DCR_LIMITS.maxRedirectUris) {
    return {
      ok: false,
      error: 'invalid_redirect_uri',
      description: `at most ${DCR_LIMITS.maxRedirectUris} redirect_uris are accepted`,
    };
  }
  for (const uri of uris) {
    if (typeof uri !== 'string' || !isAllowedRedirectUri(uri)) {
      return {
        ok: false,
        error: 'invalid_redirect_uri',
        description:
          'each redirect_uri must be https, or http on localhost / 127.0.0.1 / [::1], without a fragment',
      };
    }
  }

  if (b.token_endpoint_auth_method !== undefined && b.token_endpoint_auth_method !== 'none') {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description:
        'only public clients are registered here: token_endpoint_auth_method must be "none"',
    };
  }
  if (b.grant_types !== undefined && !isSubsetOf(b.grant_types, GRANT_TYPES)) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: `grant_types may only contain ${GRANT_TYPES.join(', ')}`,
    };
  }
  if (b.response_types !== undefined && !isSubsetOf(b.response_types, RESPONSE_TYPES)) {
    return {
      ok: false,
      error: 'invalid_client_metadata',
      description: 'response_types may only contain code',
    };
  }

  return {
    ok: true,
    metadata: {
      clientName: cleanClientName(b.client_name),
      redirectUris: Array.from(new Set(uris as string[])),
    },
  };
}

/** The RFC 7591 §3.2.1 response body for a registered client. */
export interface RegistrationResponse {
  client_id: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: 'none';
  scope: string;
}

/** Persist a validated registration and return its RFC 7591 response. */
export async function registerClient(
  metadata: RegistrationMetadata
): Promise<RegistrationResponse> {
  const clientId = `${DCR_LIMITS.clientIdPrefix}${randomBytes(18).toString('base64url')}`;
  const issuedAt = Math.floor(Date.now() / 1000);

  const db = createAdminClient() as unknown as AnySupabaseClient;
  const { error } = await db.from(DATABASE_TABLES.OAUTH_CLIENTS).insert({
    client_id: clientId,
    client_secret_hash: null,
    name: metadata.clientName,
    redirect_uris: metadata.redirectUris,
    allowed_scopes: [...SUPPORTED_SCOPE_NAMES],
    is_confidential: false,
    is_trusted: false,
    registered_via: OAUTH_CLIENT_ORIGINS.dcr,
  });
  if (error) {
    throw new Error(`Failed to register OAuth client: ${error.message}`);
  }

  return {
    client_id: clientId,
    client_id_issued_at: issuedAt,
    client_name: metadata.clientName,
    redirect_uris: metadata.redirectUris,
    grant_types: [...GRANT_TYPES],
    response_types: [...RESPONSE_TYPES],
    token_endpoint_auth_method: 'none',
    scope: SUPPORTED_SCOPE_NAMES.join(' '),
  };
}
