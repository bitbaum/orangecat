/**
 * What Cat DID must outlive the tab it did it in.
 *
 * Chips are the only record a user has of Cat's work — searched the web, read a
 * page, created a project, sent a payment. They lived entirely in React state,
 * so a reload rebuilt the thread from `cat_messages` and every chip vanished.
 * The reply survived; the evidence behind it did not.
 *
 * Two places where that is worse than cosmetic:
 *   - citations render from the tool calls that produced them, so a reloaded
 *     answer kept its [F1] handles with nothing to link them to
 *   - an action still awaiting confirmation lost its chip entirely instead of
 *     resolving, so the thing the user was asked to confirm stopped being
 *     mentioned at all
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
    // NULL is what every row written before the column existed returns, and it
    // must render exactly as it does today rather than as an empty chip strip.
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
    // The EARLIEST are kept: a turn reads in the order it happened.
    expect((stored[0] as { id: string }).id).toBe('t0');
  });

  it('caps the results inside a chip, which is where the bulk actually is', () => {
    // A search chip carries every hit with its title and url. Unbounded, this
    // writes a whole results page into a chat row, on every turn, forever.
    const stored = trimToolCallsForStorage([chip('t1', 50)])!;
    const results = (stored[0] as { results: unknown[] }).results;

    expect(results.length).toBeLessThanOrEqual(8);
    // Still enough to expand and to back the citations.
    expect(results.length).toBeGreaterThan(0);
  });

  it('leaves a chip without results untouched', () => {
    const action = { id: 'a1', name: 'create_project', status: 'completed' };
    const stored = trimToolCallsForStorage([action])!;
    expect(stored[0]).toEqual(action);
  });

  it('survives junk rather than throwing on it', () => {
    // The column is JSONB and this runs on a best-effort persistence path.
    const stored = trimToolCallsForStorage([null, 'x', 7, { id: 'ok' }])!;
    expect(stored).toHaveLength(4);
  });
});

describe('the column is actually written and actually read', () => {
  const history = stripComments(
    readFileSync(join(ROOT, 'src/services/cat/conversation-history.ts'), 'utf8')
  );

  it('writes the trimmed calls on insert', () => {
    expect(history).toContain('tool_calls: trimToolCallsForStorage(m.tool_calls)');
  });

  it('selects the column back, or the write would be invisible', () => {
    // Storing and never selecting is the same as not storing.
    expect(history).toContain('tool_calls');
    expect(history).toMatch(
      /\.select\('id, role, content, model_used, provider, token_count, tool_calls, created_at'\)/
    );
  });

  it('puts them back on the message when history loads', () => {
    const hook = stripComments(
      readFileSync(
        join(ROOT, 'src/components/ai-chat/ModernChatPanel/hooks/useChatHistory.ts'),
        'utf8'
      )
    );
    expect(hook).toContain('toolCalls: m.tool_calls ?? undefined');
  });
});

describe('the streaming turn collects its own', () => {
  const orch = stripComments(
    readFileSync(join(ROOT, 'src/services/cat/chat-orchestrator.ts'), 'utf8')
  );

  it('keeps a copy as well as sending the frame', () => {
    // The SSE frame reaches the live tab and nothing else.
    expect(orch).toContain('streamedToolCalls.push(event)');
    expect(orch).toContain('tool_calls: streamedToolCalls');
  });

  it('declares it INSIDE the streaming branch, before the save reads it', () => {
    // The bug this pins, which typechecked cleanly: the streaming branch
    // RETURNS before `collectedToolCalls` is declared, so a streaming save that
    // read that const would throw "cannot access before initialization" at
    // runtime — inside a detached catch, where it would look like nothing.
    // TDZ is not visible to tsc across a closure.
    const declaredAt = orch.indexOf('const streamedToolCalls');
    const pushedAt = orch.indexOf('streamedToolCalls.push(event)');
    const savedAt = orch.indexOf('tool_calls: streamedToolCalls');
    const nonStreamingDeclaredAt = orch.indexOf('const collectedToolCalls');

    expect(declaredAt).toBeGreaterThan(-1);
    expect(declaredAt).toBeLessThan(pushedAt);
    expect(declaredAt).toBeLessThan(savedAt);
    // And the streaming save must NOT reach for the non-streaming array.
    expect(savedAt).toBeLessThan(nonStreamingDeclaredAt);
  });

  it('still carries them on the non-streaming path', () => {
    expect(orch).toContain('tool_calls: collectedToolCalls');
  });
});

describe('the migration', () => {
  const sql = readFileSync(
    join(ROOT, 'supabase/migrations/20260912140000_what_cat_did_survives_a_reload.sql'),
    'utf8'
  );

  it('adds a nullable column, so existing rows keep behaving as they do', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS tool_calls JSONB/i);
    expect(sql).not.toMatch(/NOT NULL/i);
  });

  it('is re-runnable', () => {
    // apply-migrations runs each file in one transaction; IF NOT EXISTS keeps a
    // re-applied file from aborting a deploy.
    expect(sql).toMatch(/IF NOT EXISTS/i);
  });
});
