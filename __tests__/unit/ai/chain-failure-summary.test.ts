import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BOT_TURN_LOG_SOURCE,
  SHARED_POOL_DOWN_MESSAGE,
  chainFailureSummary,
} from '@/services/ai/chain-failure-summary';

/**
 * 2026-11-12: every bot send on the live site failed for hours. A person read
 * "That did not go through. Try again.", and the diagnostics workflow read
 * "0 failures".
 */
describe('a bot turn the shared pool could not answer', () => {
  it('records each failed link as vendor and status, and nothing a vendor said', () => {
    const secret = 'sk-private and the prompt';
    const summary = chainFailureSummary([
      { provider: 'groq', error: { statusCode: 429, message: secret } },
      { provider: 'google', error: { status: 403, message: secret } },
      { provider: 'openrouter', error: new Error(secret) },
      { provider: 'together', error: { statusCode: '500' } },
    ]);
    expect(summary).toEqual([
      { provider: 'groq', status: 429 },
      { provider: 'google', status: 403 },
      { provider: 'openrouter', status: null },
      { provider: 'together', status: null },
    ]);
    expect(JSON.stringify(summary)).not.toContain('private');
  });

  it("marks our own daily cap, so it is not read as the vendor's 429", () => {
    const capped = Object.assign(new Error('daily spending cap reached for groq (rate limit)'), {
      name: 'VendorCapReached',
      status: 429,
    });
    expect(
      chainFailureSummary([
        { provider: 'groq', error: capped },
        { provider: 'openrouter', error: { status: 429 } },
      ])
    ).toEqual([
      { provider: 'groq', status: 429, cap: true },
      { provider: 'openrouter', status: 429 },
    ]);
  });

  it('tells the person the way out that works whatever the pool does', () => {
    expect(SHARED_POOL_DOWN_MESSAGE).toMatch(/your own API key in Settings → AI/);
    expect(SHARED_POOL_DOWN_MESSAGE).not.toMatch(/Gemini|Groq|OpenRouter|502|chain/i);
  });

  it('is what the turn returns, the route passes on and the chat shows with the key', () => {
    const turn = readFileSync('src/services/ai/sendMessage-internals.ts', 'utf8');
    expect(turn).toMatch(/code: 'AI_ERROR', message: SHARED_POOL_DOWN_MESSAGE, sharedPool: true/);
    expect(turn).toMatch(/links: chainFailureSummary\(aiError\.failures\)/);
    const route = readFileSync(
      'src/app/api/ai-assistants/[id]/conversations/[convId]/messages/route.ts',
      'utf8'
    );
    expect(route).toMatch(/result\.sharedPool \? \{ sharedPool: true \} : \{\}/);
    const hook = readFileSync('src/components/companions/useCompanionTalk.ts', 'utf8');
    expect(hook).toMatch(/res\.status === 502 && pool\.sharedPool && pool\.message/);
    const chat = readFileSync('src/components/companions/talk/CompanionChat.tsx', 'utf8');
    expect(chat).toMatch(/const wayOut = talk\.limitReached \|\| talk\.poolDown;/);
    expect(chat).toMatch(/wayOut \? talk\.error : COMPANION_COPY\.room\.sendFailed/);
    // The diagnostics script reads the same source name the turn writes.
    expect(readFileSync('scripts/diagnose-cat-logs.mjs', 'utf8')).toContain(
      `'${BOT_TURN_LOG_SOURCE}'`
    );
  });
});
