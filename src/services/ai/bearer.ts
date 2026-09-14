/**
 * Authorization headers for an OpenAI-compatible endpoint.
 *
 * One rule, in one place: an empty key means NO Authorization header, not
 * `Bearer ` with nothing after it. A self-hosted vLLM or llama.cpp with no
 * auth configured accepts either, but a reverse proxy in front of one often
 * rejects a malformed bearer outright — and the user who chose "no key" was
 * telling us there is nothing to send.
 */
export function bearerHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}
