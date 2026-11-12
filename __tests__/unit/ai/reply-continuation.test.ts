/**
 * A reply the output cap cut is never stored mid-sentence.
 *
 * Seen live on 2026-11-12: a bot's answer ended "If you treat me…". The cap
 * was 1,000 tokens and the model spent part of it thinking. Pinned here: the
 * owner's turn gets room, a cut reply is continued once on the same model
 * and joined, and one that is still cut ends at a finished sentence and
 * says how to get the rest.
 */
import { describe, expect, it, vi } from 'vitest';
import { GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq-models';
import { completeOnPlatform, type PlatformProvider } from '@/services/ai/platform-providers';
import {
  CONTINUE_INSTRUCTION,
  CUT_SHORT_NOTE,
  OWNER_REPLY_MAX_TOKENS,
  closeCutOff,
  joinContinuation,
  replyTokenCap,
  wasCutOff,
} from '@/services/ai/reply-continuation';
import { finishCutOffReply } from '@/services/ai/sendMessage-internals';

const completion = (content: string, finishReason = 'stop') => ({
  content,
  model: 'm',
  inputTokens: 10,
  outputTokens: 5,
  totalTokens: 15,
  isFreeModel: true,
  usedByok: false,
  finishReason,
});

describe('replyTokenCap', () => {
  it("gives the owner's turn room, and leaves a creator's setting alone for anyone else", () => {
    expect(replyTokenCap(1000, true)).toBe(OWNER_REPLY_MAX_TOKENS);
    expect(replyTokenCap(null, true)).toBe(OWNER_REPLY_MAX_TOKENS);
    expect(replyTokenCap(8000, true)).toBe(8000);
    expect(replyTokenCap(1000, false)).toBe(1000);
    expect(replyTokenCap(null, false)).toBeUndefined();
    expect(replyTokenCap(0, false)).toBeUndefined();
  });
});

describe('joinContinuation', () => {
  it('joins on the repeated words, mending a word cut in half', () => {
    expect(joinContinuation('so the agents will contin', 'agents will continue the work.')).toBe(
      'so the agents will continue the work.'
    );
    expect(joinContinuation('If you treat me as a', 'treat me as a colleague, I will.')).toBe(
      'If you treat me as a colleague, I will.'
    );
  });

  it('without an overlap, joins on exactly one seam and keeps a paragraph break', () => {
    expect(joinContinuation('If you treat me', 'as a colleague, I will.')).toBe(
      'If you treat me as a colleague, I will.'
    );
    expect(joinContinuation('First line.\n', '\n\nSecond line.')).toBe(
      'First line.\n\nSecond line.'
    );
    expect(joinContinuation('First line.', '\nSecond line.')).toBe('First line.\nSecond line.');
    expect(joinContinuation('It works', ', mostly.')).toBe('It works, mostly.');
    expect(joinContinuation('Done.', '   ')).toBe('Done.');
  });

  it('asks the model to repeat its last words, so the halves can overlap', () => {
    expect(CONTINUE_INSTRUCTION).toContain('repeating, exactly, the last five or so words');
  });
});

describe('closeCutOff', () => {
  it('steps back to the last finished sentence and says how to get the rest', () => {
    const out = closeCutOff('I can do three things. First, read. If you treat me');
    expect(out).toBe(`I can do three things. First, read.\n\n${CUT_SHORT_NOTE}`);
  });

  it('keeps a long unfinished tail, marked, rather than dropping it', () => {
    const tail = 'word '.repeat(80).trim();
    const out = closeCutOff(`Short start. ${tail}`);
    expect(out.startsWith(`Short start. ${tail}…`)).toBe(true);
    expect(out.endsWith(CUT_SHORT_NOTE)).toBe(true);
  });

  it('closes an open code fence so the note is not inside the block', () => {
    const out = closeCutOff('Here it is:\n```ts\nconst a = 1;\nconst b =');
    expect(out).toContain('const a = 1;\n```\n\n');
    expect(out.endsWith(CUT_SHORT_NOTE)).toBe(true);
  });
});

describe('finishCutOffReply', () => {
  const messages = [{ role: 'user', content: 'Who are you?' }];

  it('leaves a finished reply alone and asks nothing more', async () => {
    const complete = vi.fn();
    const first = completion('I am Thinker.');
    expect(await finishCutOffReply(first, complete, messages)).toBe(first);
    expect(complete).not.toHaveBeenCalled();
    expect(wasCutOff('stop')).toBe(false);
  });

  it('continues a cut reply once, with its own words and the instruction, and joins it', async () => {
    const complete = vi.fn().mockResolvedValue(completion('as a colleague, I will.'));
    const out = await finishCutOffReply(
      completion('If you treat me', 'length'),
      complete,
      messages
    );
    expect(complete).toHaveBeenCalledTimes(1);
    expect(complete.mock.calls[0][0]).toEqual([
      ...messages,
      { role: 'assistant', content: 'If you treat me' },
      { role: 'user', content: CONTINUE_INSTRUCTION },
    ]);
    expect(out.content).toBe('If you treat me as a colleague, I will.');
    expect(out.finishReason).toBe('stop');
    expect(out.outputTokens).toBe(10);
    expect(out.totalTokens).toBe(30);
  });

  it('never returns a reply that ends mid-sentence: still cut, it is closed with the note', async () => {
    const complete = vi.fn().mockResolvedValue(completion('as a colleague. And then I', 'length'));
    const out = await finishCutOffReply(
      completion('If you treat me', 'length'),
      complete,
      messages
    );
    expect(complete).toHaveBeenCalledTimes(1);
    expect(out.content).toBe(`If you treat me as a colleague.\n\n${CUT_SHORT_NOTE}`);
    expect(out.finishReason).toBe('length');
  });

  it('a failed or empty continuation closes the first half instead of failing the turn', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('429'));
    const out = await finishCutOffReply(
      completion('One thing is sure. If you treat me', 'length'),
      failing,
      messages
    );
    expect(out.content).toBe(`One thing is sure.\n\n${CUT_SHORT_NOTE}`);

    const empty = vi.fn().mockResolvedValue(completion('  '));
    const out2 = await finishCutOffReply(completion('Yes. If', 'length'), empty, messages);
    expect(out2.content).toBe(`Yes.\n\n${CUT_SHORT_NOTE}`);
  });
});

describe('the platform chain takes a cap per link', () => {
  it('asks each vendor with its own cap', async () => {
    const seen: Array<[string, number | undefined]> = [];
    const link = (providerId: string, content: string): PlatformProvider =>
      ({
        providerId,
        defaultModel: `${providerId}-model`,
        toolEndpoint: '',
        toolKey: '',
        seesImages: 'unknown',
        aiService: {
          chatCompletion: async (opts: { maxTokens?: number }) => {
            seen.push([providerId, opts.maxTokens]);
            return completion(content);
          },
        },
      }) as unknown as PlatformProvider;
    const capFor = (id: string) =>
      id === 'groq'
        ? Math.min(OWNER_REPLY_MAX_TOKENS, GROQ_CHAT_MAX_TOKENS)
        : OWNER_REPLY_MAX_TOKENS;
    const { provider } = await completeOnPlatform(
      'hi',
      {
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0.7,
        maxTokens: OWNER_REPLY_MAX_TOKENS,
        maxTokensFor: capFor,
      },
      [link('groq', ''), link('gemini', 'Hello.')]
    );
    expect(provider.providerId).toBe('gemini');
    expect(seen).toEqual([
      ['groq', GROQ_CHAT_MAX_TOKENS],
      ['gemini', OWNER_REPLY_MAX_TOKENS],
    ]);
  });
});
