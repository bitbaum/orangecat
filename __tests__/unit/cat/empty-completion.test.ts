/**
 * An empty 200 is a failed link, not a finished answer.
 *
 * Behaviour contract lives in `hasUsableContent` / `EmptyCompletion`. Orchestrator
 * wiring is enforced by types + the import of this module — not by grepping
 * chat-orchestrator.ts for throw-site substrings (Prettier noise).
 */
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
