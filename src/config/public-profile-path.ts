/**
 * Canonical public identity paths.
 *
 * OrangeCat resolves public profiles by username, never by actor/user UUID.
 * Keep optional values nullable so UI can render a truthful non-link state
 * instead of inventing a plausible-looking route that always ends in 404.
 */
export function optionalPublicProfilePath(username: unknown): string | null {
  if (typeof username !== 'string') {
    return null;
  }

  const normalized = username.trim();
  return normalized ? `/profiles/${encodeURIComponent(normalized)}` : null;
}

export function publicProfilePath(username: string): string {
  const path = optionalPublicProfilePath(username);
  if (!path) {
    throw new TypeError('A non-empty username is required for a public profile path.');
  }
  return path;
}
