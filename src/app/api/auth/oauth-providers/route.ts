/**
 * GET /api/auth/oauth-providers
 *
 * Returns the OAuth providers that are actually usable on this deployment.
 *
 * GoTrue's /auth/v1/settings only says whether a provider is *flagged* enabled
 * (`GOTRUE_EXTERNAL_<P>_ENABLED=true`). A provider can be flagged on while its
 * credentials are missing/broken — its /authorize then bounces straight back to
 * the site URL instead of the identity provider, so the login button errors.
 * (Observed live: twitter flagged enabled but redirecting to the site root,
 * while google/github redirect to their real IdPs.)
 *
 * So this route is the login UI's SSOT: flagged enabled AND the authorize
 * redirect actually leaves for an external IdP. Probes run server-side (the
 * browser can't read cross-origin redirect targets) and are cached.
 */
import {
  OAUTH_PROVIDER_IDS,
  OAUTH_TO_SUPABASE,
  type OAuthProvider,
} from '@/app/auth/oauth-provider-map';
import { apiSuccess } from '@/lib/api/standardResponse';
import { logger } from '@/utils/logger';
import { CACHE_PRESETS } from '@/lib/api/cache-policy';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const CACHE_TTL_MS = 5 * 60 * 1000; // provider config changes rarely; keep probes cheap
const CACHE_CONTROL = CACHE_PRESETS.MEDIUM;

let cache: { at: number; providers: OAuthProvider[] } | null = null;

/** A provider works iff its /authorize redirect leaves for an external IdP. */
async function providerIsFunctional(gotrueKey: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(gotrueKey)}`,
      { headers: { apikey: ANON_KEY as string }, redirect: 'manual' }
    );
    if (res.status < 300 || res.status >= 400) {
      return false;
    }
    const location = res.headers.get('location');
    if (!location || location.includes('error=')) {
      return false;
    }
    // Broken providers bounce back to GoTrue's own host / site URL ("/").
    const target = new URL(location, SUPABASE_URL);
    return target.host !== new URL(SUPABASE_URL as string).host;
  } catch {
    return false;
  }
}

async function resolveWorkingProviders(): Promise<OAuthProvider[]> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: ANON_KEY as string },
  });
  const settings = (await res.json()) as { external?: Record<string, boolean> };
  const external = settings.external ?? {};

  const flaggedOn = OAUTH_PROVIDER_IDS.filter(id => external[OAUTH_TO_SUPABASE[id]]);
  const checks = await Promise.all(
    flaggedOn.map(id => providerIsFunctional(OAUTH_TO_SUPABASE[id]))
  );
  return flaggedOn.filter((_, i) => checks[i]);
}

export async function GET() {
  if (!SUPABASE_URL || !ANON_KEY) {
    return apiSuccess({ providers: [] as OAuthProvider[] }, { cache: CACHE_CONTROL });
  }

  if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
    try {
      cache = { at: Date.now(), providers: await resolveWorkingProviders() };
    } catch (error) {
      logger.error('Failed to resolve OAuth providers', error, 'Auth');
      // Fail closed: no broken buttons. Don't cache the failure for long.
      cache = { at: Date.now() - CACHE_TTL_MS + 30_000, providers: [] };
    }
  }

  return apiSuccess({ providers: cache.providers }, { cache: CACHE_CONTROL });
}
