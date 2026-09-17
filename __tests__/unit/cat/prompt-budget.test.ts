/**
 * Cat's prompt must fit the pool that answers it.
 *
 * The bug this pins: Groq's free tier refuses any single request above its
 * per-minute cap — 8 000 tokens for the models this key serves — and the Cat
 * system prompt measured ~9 100 tokens in tool mode on 2026-09-11. Every
 * message paid a guaranteed HTTP 413, fell through to OpenRouter's free pool,
 * and drained that by mid-morning, after which the user read "Free AI capacity
 * is maxed out right now" all day.
 *
 * So the first test is not about the ladder at all: it is the real prompt,
 * against the real cap, with the real reply reserve. If a section grows and
 * pushes the floor over the budget, that is the outage, and it fails here
 * rather than in production.
 */
import { describe, it, expect } from 'vitest';
import {
  DROPPABLE_SECTIONS_IN_ORDER,
  NEVER_DROPPED_SECTIONS,
  composeCatMessages,
  dropSections,
  fitCatPromptToBudget,
  type CatPromptParts,
} from '@/services/cat/prompt-budget';
import { estimateMessagesTokens } from '@/services/ai/groq-capacity';
import { GROQ_TPM_LIMIT_BY_MODEL } from '@/services/ai/groq-capacity';
import { buildCatSystemPrompt } from '@/services/cat/system-prompt';
import { getCatFewShotExamplesText } from '@/services/cat/few-shot-examples';
import { buildTurnDescriptor } from '@/services/cat/turn-descriptor';
import { GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq';

const MARGIN = 150;
const GROQ_BUDGET = GROQ_TPM_LIMIT_BY_MODEL['openai/gpt-oss-120b'] - GROQ_CHAT_MAX_TOKENS - MARGIN;

function partsFor(message: string, historyTurns: number, contextChars = 0): CatPromptParts {
  return {
    base: buildCatSystemPrompt({
      actionsVia: 'tools',
      turnDescriptor: buildTurnDescriptor({ message, historyLength: historyTurns }),
    }),
    standingInstructions: '',
    userContext: 'X'.repeat(contextChars),
    groundingRules: contextChars ? '\n\nGrounding rules block.' : '',
    fewShot: getCatFewShotExamplesText(),
    languageDirective: '',
    history: Array.from({ length: historyTurns }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `turn ${i} `.repeat(40),
    })),
    message,
  };
}

describe('the real prompt fits the real free-tier cap', () => {
  const turns: Array<[string, number]> = [
    ['hi', 0],
    ["What's missing before I publish my digital download?", 8],
    ['send 10 chf to my mother', 4],
    ['describe orangecat to a stranger', 0],
    ['find someone who needs a website', 12],
  ];

  it.each(turns)('fits with no user context: %s', (message, history) => {
    const { report } = fitCatPromptToBudget(partsFor(message, history), GROQ_BUDGET);
    expect(report.fits).toBe(true);
  });

  it('fits even with a large user context, by giving things up', () => {
    const { messages, report } = fitCatPromptToBudget(
      partsFor('what should I do next?', 20, 40_000),
      GROQ_BUDGET
    );
    expect(report.fits).toBe(true);
    expect(estimateMessagesTokens(messages)).toBeLessThanOrEqual(GROQ_BUDGET);
    // Something had to give — that is the point of the ladder.
    expect(
      report.historyDropped > 0 ||
        report.contextTruncated ||
        report.contextDropped ||
        report.fewShotDropped
    ).toBe(true);
  });

  it('the floor — every droppable section gone — is under the budget', () => {
    // The guarantee behind `fits`: if this ever exceeds the cap, no ladder can
    // save the turn and platform Groq is unusable however small the question.
    const parts = partsFor('hi', 0);
    const floor = composeCatMessages(
      { ...parts, userContext: '', groundingRules: '' },
      {
        history: [],
        includeFewShot: false,
        base: dropSections(parts.base, DROPPABLE_SECTIONS_IN_ORDER),
      }
    );
    expect(estimateMessagesTokens(floor)).toBeLessThanOrEqual(GROQ_BUDGET);
  });
});

describe('what the ladder gives up, in order', () => {
  it('keeps everything when the prompt already fits', () => {
    const parts = partsFor('hi', 4, 200);
    const { report } = fitCatPromptToBudget(parts, 1_000_000);
    expect(report).toMatchObject({
      fits: true,
      historyDropped: 0,
      contextTruncated: false,
      fewShotDropped: false,
      sectionsDropped: [],
    });
  });

  it('drops old history before touching the context', () => {
    const parts = partsFor('hello', 20, 300);
    const roomy = estimateMessagesTokens(
      composeCatMessages(parts, { history: parts.history.slice(-6), includeFewShot: true })
    );
    const { report } = fitCatPromptToBudget(parts, roomy);
    expect(report.historyDropped).toBeGreaterThan(0);
    expect(report.contextTruncated).toBe(false);
    expect(report.sectionsDropped).toEqual([]);
  });

  it('never drops a load-bearing section, even at an impossible budget', () => {
    const parts = partsFor('hi', 0);
    const { messages, report } = fitCatPromptToBudget(parts, 10);
    expect(report.fits).toBe(false);
    for (const heading of NEVER_DROPPED_SECTIONS) {
      if (parts.base.includes(`## ${heading}`)) {
        expect(messages[0].content).toContain(`## ${heading}`);
      }
    }
  });

  it('a shortened context says so in the prompt; a dropped one reports as dropped', () => {
    const parts = partsFor('what do you know about me?', 0, 60_000);
    const { messages, report } = fitCatPromptToBudget(parts, GROQ_BUDGET);
    expect(estimateMessagesTokens(messages)).toBeLessThanOrEqual(GROQ_BUDGET);
    // Exactly one of the two — reporting "gone" as "shortened" is how a silent
    // context loss comes to look like a model that simply forgot.
    expect(report.contextTruncated).not.toBe(report.contextDropped);
    if (report.contextTruncated) {
      expect(messages[0].content).toContain('context shortened');
    }
  });

  it('shortens the context before dropping it', () => {
    const parts = partsFor('what do you know about me?', 0, 12_000);
    const floorTokens = estimateMessagesTokens(
      composeCatMessages(parts, { history: [], includeFewShot: true, contextChars: 0 })
    );
    const { report } = fitCatPromptToBudget(parts, floorTokens + 400);
    expect(report.contextTruncated).toBe(true);
    expect(report.contextDropped).toBe(false);
    expect(report.contextChars).toBeGreaterThan(0);
  });

  it('the user message and system prompt always survive', () => {
    const parts = partsFor('a question worth answering', 30, 90_000);
    const { messages } = fitCatPromptToBudget(parts, 500);
    expect(messages[0].role).toBe('system');
    expect(messages[messages.length - 1]).toEqual({
      role: 'user',
      content: 'a question worth answering',
    });
  });

  it('droppable and never-dropped sections do not overlap', () => {
    const droppable = new Set(DROPPABLE_SECTIONS_IN_ORDER);
    for (const heading of NEVER_DROPPED_SECTIONS) {
      expect(droppable.has(heading)).toBe(false);
    }
  });
});
