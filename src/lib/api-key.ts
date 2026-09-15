/**
 * One definition of "make this credential safe to send in a header".
 *
 * API keys arrive from env vars, `.env` files and BYOK paste boxes, and they
 * sometimes carry a trailing newline or a paste artifact. `Headers.append`
 * rejects those with "invalid header value" — an error that tends to take the
 * key's contents along with it into a log line. Trim defensively at every
 * entry point instead.
 *
 * This lived as five identical copies (transcribe route, groq, openai-compat,
 * openrouter, health probes). It touches credentials, so it gets one
 * definition and a test: see `__tests__/unit/lib/api-key.test.ts`.
 */

// eslint-disable-next-line no-control-regex -- stripping control chars is the point
const HEADER_UNSAFE = /[\s\x00-\x1f\x7f]+/g;

/** Strip whitespace and control characters so the key can go in a header. */
export function sanitizeApiKey(key: string): string {
  return key.replace(HEADER_UNSAFE, '');
}

/**
 * Same sanitize, but also reports whether anything had to be removed — health
 * probes surface that as "your key has junk characters in it" rather than
 * silently papering over a broken env var.
 */
export function sanitizeApiKeyChecked(key: string): { clean: string; hadJunk: boolean } {
  const clean = sanitizeApiKey(key);
  return { clean, hadJunk: clean !== key };
}
