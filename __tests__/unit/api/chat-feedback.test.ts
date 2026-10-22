/**
 * POST /api/chat/feedback — the body is chatkit's AnswerFeedback plus the
 * conversation, and a thumb resolves to the stored answer it was given on.
 */
import { describe, expect, it, vi } from 'vitest';
import { chatFeedbackSchema, resolveFeedbackMessageId } from '@/services/cat/chat-feedback';

const CONV = '2c0f9b8e-3f1c-4f7a-9d7b-6a2a1c3e5f10';
const MSG = '7b5e2a10-1c2d-4e3f-8a9b-0c1d2e3f4a5b';

describe('chatFeedbackSchema', () => {
  it('accepts what chatkit sends', () => {
    expect(
      chatFeedbackSchema.parse({ conversationId: CONV, messageId: 'assistant-1', verdict: 'up' })
    ).toEqual({ conversationId: CONV, messageId: 'assistant-1', verdict: 'up' });
    expect(
      chatFeedbackSchema.parse({
        conversationId: CONV,
        messageId: MSG,
        verdict: 'down',
        reason: 'dead_end',
        text: ' it just said no ',
      }).text
    ).toBe('it just said no');
  });
  it('refuses an unknown verdict or reason, and words over 1000 chars', () => {
    expect(
      chatFeedbackSchema.safeParse({ conversationId: CONV, messageId: MSG, verdict: 'meh' }).success
    ).toBe(false);
    expect(
      chatFeedbackSchema.safeParse({
        conversationId: CONV,
        messageId: MSG,
        verdict: 'down',
        reason: 'bad',
      }).success
    ).toBe(false);
    expect(
      chatFeedbackSchema.safeParse({
        conversationId: CONV,
        messageId: MSG,
        verdict: 'down',
        text: 'x'.repeat(1001),
      }).success
    ).toBe(false);
    expect(
      chatFeedbackSchema.safeParse({ conversationId: 'c1', messageId: MSG, verdict: 'up' }).success
    ).toBe(false);
  });
});

describe('resolveFeedbackMessageId', () => {
  const client = (stored: string | null, latest: string | null) => {
    const q: Record<string, unknown> = {};
    let mode: 'stored' | 'latest' = 'latest';
    for (const m of ['select', 'eq', 'order', 'limit']) {
      q[m] = (...args: unknown[]) => {
        if (m === 'eq' && args[0] === 'id') mode = 'stored';
        return q;
      };
    }
    q.maybeSingle = async () => ({
      data: mode === 'stored' ? (stored ? { id: stored } : null) : latest ? { id: latest } : null,
    });
    return { from: vi.fn(() => q) } as never;
  };

  it('keeps a stored row id', async () => {
    expect(await resolveFeedbackMessageId(client(MSG, 'other'), CONV, MSG)).toBe(MSG);
  });
  it("resolves a live turn's client id to the newest stored answer", async () => {
    expect(await resolveFeedbackMessageId(client(null, MSG), CONV, 'assistant-1729000000')).toBe(
      MSG
    );
  });
  it('keeps the given id when nothing is stored yet', async () => {
    expect(await resolveFeedbackMessageId(client(null, null), CONV, 'assistant-1')).toBe(
      'assistant-1'
    );
  });
});
