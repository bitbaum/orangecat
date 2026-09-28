/**
 * OIDC signing keys (env-based RS256).
 *
 * The private key lives ONLY in the environment (`OAUTH_JWT_PRIVATE_KEY`, a
 * base64-encoded PKCS#8 PEM) — never in the repo or the DB. The public half is
 * derived at runtime and served at /oauth/jwks.json so relying parties verify
 * tokens. `OAUTH_JWT_KID` ties issued tokens (header `kid`) to the JWK.
 *
 * Rotation (env-only, v1): set OAUTH_JWT_PRIVATE_KEY/OAUTH_JWT_KID to the new
 * key, and add the previous PUBLIC JWK to OAUTH_JWT_PREVIOUS_JWKS (JSON array)
 * so in-flight tokens still verify until they expire. A DB keys table is the
 * later upgrade if zero-downtime auto-rotation is needed.
 *
 * Loading is lazy + cached: importing this module never throws, so the app boots
 * even where OIDC env isn't set (e.g. some dev/test). The error surfaces only
 * when an OIDC endpoint actually needs to sign or publish a key.
 */
import {
  importPKCS8,
  exportJWK,
  createLocalJWKSet,
  jwtVerify,
  type JWK,
  type CryptoKey,
  type JWTPayload,
} from 'jose';
import { createPublicKey } from 'node:crypto';
import { OAUTH_ISSUER, OAUTH_SIGNING_ALG } from './config';

interface SigningKey {
  privateKey: CryptoKey;
  publicJwk: JWK; // includes kid, alg, use
  kid: string;
}

let cached: SigningKey | null = null;

function decodePem(b64: string): string {
  const pem = Buffer.from(b64, 'base64').toString('utf8').trim();
  if (!pem.includes('BEGIN') || !pem.includes('PRIVATE KEY')) {
    throw new Error('OAUTH_JWT_PRIVATE_KEY is not a base64-encoded PKCS#8 private-key PEM');
  }
  return pem;
}

export async function getSigningKey(): Promise<SigningKey> {
  if (cached) {
    return cached;
  }
  const b64 = process.env.OAUTH_JWT_PRIVATE_KEY;
  const kid = process.env.OAUTH_JWT_KID;
  if (!b64 || !kid) {
    throw new Error(
      'OIDC signing key not configured: set OAUTH_JWT_PRIVATE_KEY (base64 PKCS#8 PEM) and OAUTH_JWT_KID'
    );
  }
  const pem = decodePem(b64);
  const privateKey = await importPKCS8(pem, OAUTH_SIGNING_ALG, { extractable: false });

  // Derive the public JWK from the private PEM (no separate public env needed).
  const publicKeyObj = createPublicKey(pem);
  const publicJwk = await exportJWK(publicKeyObj);
  publicJwk.kid = kid;
  publicJwk.alg = OAUTH_SIGNING_ALG;
  publicJwk.use = 'sig';

  cached = { privateKey, publicJwk, kid };
  return cached;
}

/** Public JWK Set for /oauth/jwks.json (current key + any retired-but-unexpired keys). */
export async function getPublicJwks(): Promise<{ keys: JWK[] }> {
  const { publicJwk } = await getSigningKey();
  const keys: JWK[] = [publicJwk];

  const previousRaw = process.env.OAUTH_JWT_PREVIOUS_JWKS;
  if (previousRaw) {
    try {
      const prev = JSON.parse(previousRaw) as JWK[];
      if (Array.isArray(prev)) {
        keys.push(...prev.filter(k => k && k.kid !== publicJwk.kid));
      }
    } catch {
      // Malformed previous-keys env is non-fatal: serve the current key only.
    }
  }
  return { keys };
}

/**
 * Verify an OrangeCat-issued access/id token against our own public key set.
 * Returns the payload on success, or null on ANY failure (bad signature, wrong
 * issuer, expired, not our token, and — when `audience` is given — minted for
 * someone else). Callers must treat null as "not an OIDC token" and may fall
 * through to other auth — so it must not throw.
 *
 * A resource server that tokens are bound to (RFC 8707, e.g. /api/mcp) passes
 * its own identifier as `audience`; without it only the issuer is checked.
 */
export async function verifyAccessToken(
  token: string,
  opts: { audience?: string } = {}
): Promise<JWTPayload | null> {
  try {
    const jwks = await getPublicJwks();
    const keySet = createLocalJWKSet(jwks);
    const { payload } = await jwtVerify(token, keySet, {
      issuer: OAUTH_ISSUER,
      ...(opts.audience ? { audience: opts.audience } : {}),
    });
    return payload;
  } catch {
    return null;
  }
}
