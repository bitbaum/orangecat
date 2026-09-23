import { buildFailedTurnMessages, TRUNCATED_REPLY_SUFFIX } from '@/services/cat/failed-turn';

/**
 * A failed Cat turn must still keep the user's message.
 *
 * The streaming path saved a turn only `if (fullContent)`, so when the whole
 * provider chain died the exchange was discarded — including the question.
 * Behaviour contract is `buildFailedTurnMessages`; orchestrator wiring is not
 * re-proven by grepping chat-orchestrator.ts.
 */

const ERROR_TEXT = 'Cat couldn’t reach an AI model just now — this is usually momentary.';

describe('failed Cat turns are still recorded', () => {
  it("keeps the user's message verbatim when nothing streamed", () => {
    const question = 'can I fund a solar project in sats?';
    const rows = buildFailedTurnMessages({ message: question, errorText: ERROR_TEXT });
    expect(rows.find(r => r.role === 'user')?.content).toBe(question);
  });

  it('stores the sentence the user was actually shown', () => {
    const rows = buildFailedTurnMessages({ message: 'hi', errorText: ERROR_TEXT });
    expect(rows.find(r => r.role === 'assistant')?.content).toBe(ERROR_TEXT);
  });

  it('marks a half-streamed reply as truncated instead of passing it off as complete', () => {
    const rows = buildFailedTurnMessages({
      message: 'explain lightning',
      partialContent: 'Lightning is a payment layer that',
      errorText: ERROR_TEXT,
    });
    const assistant = rows.find(r => r.role === 'assistant')!;
    expect(assistant.content).toContain('Lightning is a payment layer that');
    expect(assistant.content).toContain(TRUNCATED_REPLY_SUFFIX.trim());
    expect(assistant.content).not.toContain(ERROR_TEXT);
  });

  it('emits a user/assistant pair so replayed history never has two user turns in a row', () => {
    for (const partialContent of ['', 'partial text']) {
      const rows = buildFailedTurnMessages({ message: 'q', partialContent, errorText: ERROR_TEXT });
      expect(rows.map(r => r.role)).toEqual(['user', 'assistant']);
    }
  });

  it('never stores an empty assistant turn, even with no error copy to fall back on', () => {
    const rows = buildFailedTurnMessages({ message: 'q', partialContent: '   ', errorText: '' });
    expect(rows.find(r => r.role === 'assistant')?.content.trim()).not.toBe('');
  });

  it('records which provider and model were active when it failed', () => {
    const rows = buildFailedTurnMessages({
      message: 'q',
      errorText: ERROR_TEXT,
      model: 'llama-3.3-70b',
      provider: 'groq',
    });
    const assistant = rows.find(r => r.role === 'assistant')!;
    expect(assistant.model_used).toBe('llama-3.3-70b');
    expect(assistant.provider).toBe('groq');
  });
});
