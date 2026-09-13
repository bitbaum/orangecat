/**
 * An empty 200 is a failed link, not a finished answer.
 *
 * This misreading has been shipped three times. `callPlatformJson` returned
 * `content ?? null` — `??` passes an EMPTY STRING — and returned on the first
 * `response.ok`, so eight Cat features silently did nothing. That instance was
 * fixed; the SHAPE was not, and the chat orchestrator repeated it twice more:
 * the streaming path finalised an empty stream into a canned apology, and the
 * non-streaming path's `while (!result && ...)` accepted any object as an
 * answer. Both ended the chat with working links untried.
 *
 * Why it is worth this much test: an empty 200 comes from ordinary causes, not
 * only from broken vendors. A reasoning model truncated by `max_tokens` returns
 * one — shown on Groq gpt-oss-120b, which answered '' at max_tokens 16 and 24
 * (finish_reason 'length') and 'ready' at 64 and 256. An earlier draft of these
 * tests cited three OpenRouter models as empty on the strength of a
 * `max_tokens: 16` probe; that was the probe's fault and the claim is withdrawn.
 *
 * What survives is the part that matters: whatever causes it, a blank reply is
 * not an answer, and scoring it as one ended the turn.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { hasUsableContent, EmptyCompletion } from '@/services/cat/empty-completion';

describe('what counts as an answer', () => {
  it('accepts real text', () => {
    expect(hasUsableContent('Bitcoin is a payment network.')).toBe(true);
  });

  it('rejects the empty string — the exact value `??` let through', () => {
    expect(hasUsableContent('')).toBe(false);
  });

  it('rejects whitespace, which renders as a blank bubble', () => {
    expect(hasUsableContent('   ')).toBe(false);
    expect(hasUsableContent('\n\t ')).toBe(false);
  });

  it('rejects a missing value', () => {
    expect(hasUsableContent(undefined)).toBe(false);
    expect(hasUsableContent(null)).toBe(false);
  });
});

describe('the sentinel names the link that produced nothing', () => {
  it('carries provider and model so the caller can mark it down', () => {
    const err = new EmptyCompletion('openrouter', 'cohere/north-mini-code:free');
    expect(err.provider).toBe('openrouter');
    expect(err.model).toBe('cohere/north-mini-code:free');
    expect(err.name).toBe('EmptyCompletion');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('the orchestrator treats an empty completion as a failure', () => {
  const src = readFileSync(
    join(__dirname, '../../../src/services/cat/chat-orchestrator.ts'),
    'utf8'
  );

  it('raises rather than finalising when a stream produced nothing', () => {
    // `emitDone()` writes the apology and completes the stream. Reaching it
    // with nothing streamed is what made an empty 200 look like an answer.
    const consume = src.slice(
      src.indexOf('const consumeStream'),
      src.indexOf('// Walk the fallback chain')
    );
    expect(consume).toContain('throw new EmptyCompletion(activeProvider, activeModel)');
    // Both exits — the `done` chunk AND a stream that just stops — are guarded.
    expect(consume.match(/throw new EmptyCompletion/g)?.length).toBe(2);
  });

  it('keeps the apology for the case where the WHOLE chain came back empty', () => {
    // The sentence was always right for that case; it just has to be the
    // chain's verdict rather than the first link's. Throwing instead would
    // replace a polite ending with an error page.
    expect(src).toContain('if (lastErr instanceof EmptyCompletion && !streamStarted)');
  });

  it('does not accept an empty non-streaming result as an answer', () => {
    // `while (!result && ...)` treats any object as success, so the result has
    // to be cleared for the walk to continue.
    const matches = src.match(/if \(!hasUsableContent\(result\?\.content\)\) \{\s*\n\s*result = undefined;/g);
    expect(matches?.length).toBe(2);
  });

  it('marks the empty link down so the next message skips it', () => {
    // An EmptyCompletion is not a GroqPreflightSkip, so it flows through the
    // existing markLinkDown branches rather than needing a new one.
    expect(src).toContain('markLinkDown');
    expect(src).not.toContain('lastErr instanceof EmptyCompletion || lastErr instanceof GroqPreflightSkip');
  });

  it('keeps the decision in one place instead of re-deriving it', () => {
    // The whole point of the module. A fourth copy is how this bug returns.
    expect(src).not.toContain("result?.content?.trim()");
    expect(src).toContain("from '@/services/cat/empty-completion'");
  });
});
