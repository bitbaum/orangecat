/**
 * GET /api/auth/passkeys/available — whether this deployment's auth server has
 * passkeys switched on. Public, cacheable: it is a fact about the server, not
 * about anyone. The settings page reads it to decide whether to show the
 * passkeys card; /auth reads the same helper server-side.
 */
import { apiSuccess } from '@/lib/api/standardResponse';
import { CACHE_PRESETS } from '@/lib/api/cache-policy';
import { arePasskeysEnabled } from '@/lib/auth/passkeys-availability';

export const dynamic = 'force-dynamic';

export async function GET() {
  return apiSuccess({ available: await arePasskeysEnabled() }, { cache: CACHE_PRESETS.SHORT });
}
