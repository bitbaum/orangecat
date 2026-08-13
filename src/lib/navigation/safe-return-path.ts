const FALLBACK_RETURN_PATH = '/dashboard';
const INTERNAL_ORIGIN = 'https://orangecat.invalid';

/**
 * Validate an auth callback target as an application-relative URL.
 * Absolute/protocol-relative URLs, backslashes, control characters, and auth
 * loops all collapse to the supplied safe fallback.
 */
export function safeReturnPath(
  value: unknown,
  fallback: string = FALLBACK_RETURN_PATH
): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const candidate = value.trim();
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    /[\\\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_ORIGIN);
    if (parsed.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }
    if (parsed.pathname === '/auth' || parsed.pathname.startsWith('/auth/')) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function authLoginPath(returnTo?: string): string {
  const query = new URLSearchParams({ mode: 'login' });
  if (returnTo) {
    query.set('from', safeReturnPath(returnTo));
  }
  return `/auth?${query.toString()}`;
}
