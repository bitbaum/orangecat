/**
 * A chain that falls back hides the link that failed.
 *
 * Losses were logged in the orchestrator and wins were not, so a provider
 * failing every call and one answering every call produced the same silence —
 * the fallback served both identically. That is how Groq spent days answering
 * 400 to every structured call with no symptom but a slower reply.
 *
 * The consumer of these lines lives in another repo: the box sweep
 * (loki: scripts/hetzner/ai-provider-check.sh) selects failures and wins BY
 * MESSAGE and divides one by the other. So the literal strings below are a
 * contract, not decoration — renaming one here silently turns the rate back
 * into a floor, with nothing failing anywhere to say so.
 *
 * Source assertions rather than a driven orchestrator, matching
 * empty-completion.test.ts: the success points are two lines deep in a
 * streaming controller, and a test that has to build that whole world tests
 * the scaffolding more than the claim.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(process.cwd(), 'src/services/cat/chat-orchestrator.ts'), 'utf8');

describe('the chat path records which link answered', () => {
  it('logs a served turn with the message the sweep greps for', () => {
    // Must contain "model call served" — ai-provider-check.sh SERVED_RE.
    expect(SRC).toContain("'Cat chat: model call served'");
  });

  it('emits it whatever the log level, because production runs at warn', () => {
    // Without { always: true } the line never reaches the journal and the
    // sweep sees losses only — which is exactly how this shipped inert once.
    const helper = SRC.slice(SRC.indexOf('function logServed'));
    expect(helper.slice(0, 400)).toContain('always: true');
  });

  it('carries the link as provider/model, the shape the sweep parses', () => {
    const helper = SRC.slice(SRC.indexOf('function logServed'));
    expect(helper.slice(0, 400)).toContain('link: `${provider}/${model}`');
  });

  it('records the win on BOTH success paths, streaming and not', () => {
    // Two call sites plus the definition. A win logged on one path only makes
    // the other path's links look permanently dead.
    const calls = SRC.match(/logServed\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });

  it('logs the streaming win only after done was emitted', () => {
    // Logging when the stream OPENS would count a link that then produced an
    // empty completion — the failure this file's neighbour exists to catch.
    const streaming = SRC.slice(SRC.indexOf('doneEmitted = true;'));
    expect(streaming.slice(0, 200)).toContain('logServed(activeProvider, activeModel)');
  });

  it('never puts the message or the answer in the log payload', () => {
    const helper = SRC.slice(
      SRC.indexOf('function logServed'),
      SRC.indexOf('function logServed') + 400
    );
    for (const leak of ['fullContent', 'message,', 'content:']) {
      expect(helper).not.toContain(leak);
    }
  });
});
