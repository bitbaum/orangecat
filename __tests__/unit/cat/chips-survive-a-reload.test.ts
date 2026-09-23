/**
 * What Cat DID must outlive the tab it did it in.
 *
 * Chips lived in React state; a reload rebuilt from `cat_messages` and every
 * chip vanished. Contract: trim for storage, and the orchestrator must collect
 * streamed tool calls before the save reads them (TDZ bug).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { trimToolCallsForStorage } from '@/services/cat/conversation-history';

const ROOT = join(__dirname, '../../..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const chip = (id: string, results = 0) => ({
  id,
  name: 'web_search',
  status: 'completed',
  resultCount: results,
  results: Array.from({ length: results }, (_, i) => ({
    url: `https://example.com/${i}`,
    title: `Result ${i}`,
    type: 'page',
  })),
});

describe('a turn is stored without storing the whole web', () => {
  it('keeps nothing when there was nothing — the old rows stay the old rows', () => {
    expect(trimToolCallsForStorage([])).toBeNull();
    expect(trimToolCallsForStorage(undefined)).toBeNull();
    expect(trimToolCallsForStorage(null)).toBeNull();
    expect(trimToolCallsForStorage('not an array')).toBeNull();
  });

  it('caps how many chips one turn may persist', () => {
    const many = Array.from({ length: 40 }, (_, i) => chip(`t${i}`));
    const stored = trimToolCallsForStorage(many)!;
    expect(stored.length).toBeLessThanOrEqual(12);
    expect(stored.length).toBeGreaterThan(0);
    expect((stored[0] as { id: string }).id).toBe('t0');
  });

  it('caps the results inside a chip, which is where the bulk actually is', () => {
    const stored = trimToolCallsForStorage([chip('t1', 50)])!;
    const results = (stored[0] as { results: unknown[] }).results;
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results.length).toBeGreaterThan(0);
  });

  it('leaves a chip without results untouched', () => {
    const action = { id: 'a1', name: 'create_project', status: 'completed' };
    expect(trimToolCallsForStorage([action])![0]).toEqual(action);
  });

  it('survives junk rather than throwing on it', () => {
    expect(trimToolCallsForStorage([null, 'x', 7, { id: 'ok' }])).toHaveLength(4);
  });
});

describe('the streaming turn collects its own', () => {
  const orch = stripComments(
    readFileSync(join(ROOT, 'src/services/cat/chat-orchestrator.ts'), 'utf8')
  );

  it('declares streamedToolCalls INSIDE the streaming branch, before the save', () => {
    // TDZ: streaming branch RETURNS before collectedToolCalls is declared —
    // invisible to tsc across a closure. Keep this one source pin.
    const declaredAt = orch.indexOf('const streamedToolCalls');
    const pushedAt = orch.indexOf('streamedToolCalls.push(event)');
    const savedAt = orch.indexOf('tool_calls: streamedToolCalls');
    const nonStreamingDeclaredAt = orch.indexOf('const collectedToolCalls');

    expect(declaredAt).toBeGreaterThan(-1);
    expect(declaredAt).toBeLessThan(pushedAt);
    expect(declaredAt).toBeLessThan(savedAt);
    expect(savedAt).toBeLessThan(nonStreamingDeclaredAt);
  });
});
