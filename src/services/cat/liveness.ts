/**
 * Can the platform LLM answer RIGHT NOW?
 *
 * `callPlatformJson` is the single call behind eight Cat features — the offer
 * engine, both writing engines, prompt suggestions, platform feedback, image
 * suggestions, the voice intent router, and the Cat's replies. It has been
 * silently dead twice: once when Groq stopped serving the pinned
 * `llama-3.3-70b-versatile`, and once by construction, returning an empty 200
 * as though it were an answer.
 *
 * Both times the symptom was the same and it was SILENCE. Every caller
 * "degrades gracefully" to null, so a dead chain looks exactly like a quiet
 * afternoon, and `/api/health` carries no AI field at all — it reports the
 * website, the API, the database, auth and the Bitcoin integration, and has
 * never had anything to say about whether the Cat can think.
 *
 * This route is the thing that can say so, and it says it by making a real
 * call rather than by inferring from an absence of complaints.
 *
 * ── It probes the REAL path ──────────────────────────────────────────────────
 * `ask` calls `callPlatformJson` itself — the same function those eight
 * features call, including its response_format retry and its own chain order.
 * A probe assembled from a private provider list would test something nothing
 * else uses, and would drift the first time the registry changed.
 *
 * ── Gating and caching are ai-kit's ──────────────────────────────────────────
 * A probe spends real tokens from the same free pool the Cat runs on, so it
 * runs only on `?probe=1` WITH the secret, a success is cached ten minutes, and
 * a failure is never cached. With no secret configured it answers 501 rather
 * than becoming an open endpoint that can spend money.
 */

import { createAiHealthHandler } from '@bitbaum/ai-kit';

import { callPlatformJson } from './platform-llm';

/**
 * Built lazily. Next evaluates module-level code during the BUILD, where the
 * runtime's keys are absent — an eagerly-built handler would capture that empty
 * environment and report a dead engine forever on a deployment whose keys are
 * fine.
 */
let handler: ((request: Request) => Promise<Response>) | null = null;

export function catLivenessHandler(request: Request): Promise<Response> {
  handler ??= createAiHealthHandler({
    // A getter, not a value: the handler is built once and reused, so a plain
    // string would be whatever the environment held on the first request —
    // un-rotatable without a restart, and untestable.
    secret: () => process.env.AI_PROBE_SECRET,
    ask: async () => {
      // JSON, because that is what every real caller asks for — a probe that
      // requested prose would not exercise the response_format path, which is
      // the part free models actually differ on.
      const raw = await callPlatformJson(
        'You reply with JSON only, no prose.',
        'Reply with exactly {"colour":"blue"} and nothing else.',
        // Generous on purpose: the chain leads with reasoning models, which
        // spend this budget thinking before emitting a visible token, and an
        // empty completion is a failure. A mean budget would make a healthy
        // deployment report itself dead.
        { maxTokens: 256, temperature: 0, timeoutMs: 20_000 }
      );

      // callPlatformJson returns null on every failure so its callers can
      // degrade. Null here is a dead chain, and saying so is the whole job.
      return { text: raw ?? '', id: 'platform-llm' };
    },
  });
  return handler(request);
}
