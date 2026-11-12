/**
 * How the caller's session was signed in: the `amr` methods of its access
 * token ("password", "otp", "oauth", ...).
 *
 * Read from the token in the request's own cookies. Call it only after the
 * request has been authenticated (`withAuth` has asked the auth server about
 * this same token), so the payload being decoded here is one the auth server
 * has already vouched for. Empty when it cannot be read, which every caller
 * must treat as "unknown", the closed side.
 */
import type { AnySupabaseClient } from '@/lib/supabase/types';

interface AmrEntry {
  method?: unknown;
}

export async function sessionMethods(supabase: AnySupabaseClient): Promise<string[]> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const payload = token?.split('.')[1];
    if (!payload) {
      return [];
    }
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      amr?: unknown;
    };
    if (!Array.isArray(claims.amr)) {
      return [];
    }
    return claims.amr
      .map(entry => (typeof entry === 'string' ? entry : (entry as AmrEntry)?.method))
      .filter((method): method is string => typeof method === 'string');
  } catch {
    return [];
  }
}
