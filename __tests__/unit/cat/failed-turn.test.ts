import { saveMessages } from '@/services/cat/conversation-history';
import {
  buildFailedTurnMessages,
  TRUNCATED_REPLY_SUFFIX,
  completedHistory,
} from '@/services/cat/failed-turn';

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
  it('keeps the failure code and recovery message separately from partial content', () => {
    const rows = buildFailedTurnMessages({
      message: 'question',
      partialContent: 'Partial reply',
      errorText: ERROR_TEXT,
      errorCode: 'ALL_PROVIDERS_DOWN',
    });
    expect(rows[1].failure).toEqual({ kind: 'ALL_PROVIDERS_DOWN', message: ERROR_TEXT });
    expect(rows[1].content).toContain('Partial reply');
    expect(rows[0].failure).toBeUndefined();
  });
  it('does not teach the next model that provider errors were its previous advice', () => {
    const good = [
      { role: 'user' as const, content: 'first question' },
      { role: 'assistant' as const, content: 'real answer' },
    ];
    const failed = buildFailedTurnMessages({ message: 'failed question', errorText: ERROR_TEXT });
    expect(completedHistory([...good, ...failed])).toEqual(good);
  });
  it('surfaces a failed required history write instead of silently claiming persistence', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'database unavailable' } });
    const supabase = { from: () => ({ insert }) } as never;
    const rows = buildFailedTurnMessages({ message: 'question', errorText: ERROR_TEXT });
    await expect(
      saveMessages(supabase, 'conversation', 'user', rows, { requireWrite: true })
    ).rejects.toThrow('Could not persist failed conversation turn');
    expect(insert.mock.calls[0][0][1].failure).toEqual(rows[1].failure);
  });
});
