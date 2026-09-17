import { readFileSync } from 'node:fs';
import { labelForTool } from '@/lib/chat/tool-labels';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLATFORM_TOOL_DEFINITION } from '@/services/cat/tool-use-detection';
import { isCatActionTool } from '@/services/cat/action-as-tool';
import { formatTrackRecordForModel, type CatTrackRecord } from '@/services/cat/track-record';

/**
 * ADR-0006 D6 — Cat can check its own work.
 *
 * The track record already existed as ambient context. This makes it a READ
 * TOOL the model can call, so "what did you do for me?" is answered from the
 * action log, and so Cat can see its own pattern (drafted, never published)
 * before proposing more of the same.
 */

const ROOT = join(__dirname, '../../..');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

const TOOL = 'check_my_track_record';

function record(overrides: Partial<CatTrackRecord> = {}): CatTrackRecord {
  return {
    proposed: 0,
    published: 0,
    funded: 0,
    totalFundedBtc: 0,
    entries: [],
    setbacks: { failed: 0, denied: 0, unconfirmed: 0, recent: [] },
    windowDays: 90,
    ...overrides,
  };
}

describe('check_my_track_record is wired as a read tool', () => {
  it('is offered as a zero-argument tool definition', () => {
    const def = PLATFORM_TOOL_DEFINITION.find(t => t.function.name === TOOL);
    expect(def).toBeDefined();
    expect(def!.function.parameters).toEqual({ type: 'object', properties: {} });
    // Disambiguation is in the description, not left to luck: the sibling
    // tool query_my_data owns the user's own numbers.
    expect(def!.function.description).toContain('query_my_data');
  });

  it('is a read tool, so the action registry never claims the name', () => {
    expect(isCatActionTool(TOOL)).toBe(false);
  });

  it('is dispatched by the executor and described to the router', () => {
    // Call syntax, comment-stripped: a mention in a comment cannot satisfy this.
    const executor = stripComments(
      readFileSync(join(ROOT, 'src/services/cat/tool-executor.ts'), 'utf8')
    );
    expect(executor).toContain(`if (toolName === '${TOOL}') {`);
    expect(executor).toContain('handleCheckMyTrackRecord(supabase, userId, toolCall, onToolCall)');

    const router = stripComments(readFileSync(join(ROOT, 'src/services/cat/tool-use.ts'), 'utf8'));
    expect(router).toContain(`'- ${TOOL}: `);

    // Without a label the chip would read "Done (3)" for a self-audit. Asserted
    // against the LABEL MODULE, not the component: the wording moved out of the
    // chip when it started deriving action labels from the registry, and a scan
    // pointed at the old file would pass or fail for reasons that have nothing
    // to do with whether the label exists.
    const labels = stripComments(readFileSync(join(ROOT, 'src/lib/chat/tool-labels.ts'), 'utf8'));
    expect(labels).toContain(`${TOOL}: {`);
    // Behaviour, not just text: a self-audit must not borrow search wording.
    expect(labelForTool(TOOL).completed(3)).toContain('record');
  });
});

describe('formatTrackRecordForModel', () => {
  it('admits when the record could not be read, and forbids reconstruction', () => {
    const out = formatTrackRecordForModel(null);
    expect(out).toContain('could not be read');
    expect(out).toContain('do not reconstruct it from memory');
    // Unknown is not empty: a null record must never read as a clean slate.
    expect(out).not.toContain('nothing yet');
  });

  it('says "nothing yet" plainly on an empty window rather than inventing history', () => {
    const out = formatTrackRecordForModel(record());
    expect(out).toContain('nothing yet');
    expect(out).toContain('do not invent history');
    expect(out).not.toContain('PATTERN');
  });

  it('lists what was created with its real state, including deletions', () => {
    const out = formatTrackRecordForModel(
      record({
        proposed: 2,
        published: 1,
        funded: 1,
        totalFundedBtc: 0.002,
        entries: [
          {
            entityType: 'service',
            entityId: 'a',
            title: 'Haircuts',
            createdAt: '2026-09-01T10:00:00Z',
            status: 'active',
            fundedBtc: 0.002,
            payments: 2,
          },
          {
            entityType: 'product',
            entityId: 'b',
            title: 'Mugs',
            createdAt: '2026-08-20T10:00:00Z',
            status: null,
            fundedBtc: 0,
            payments: 0,
          },
        ],
      })
    );
    expect(out).toContain('proposed 2, published 1');
    expect(out).toContain('service "Haircuts" — status active, 0.002 BTC from 2 payment(s)');
    expect(out).toContain('product "Mugs" — deleted since');
    expect(out).toContain('Amounts are BTC');
  });

  it('names the drafted-never-published pattern so Cat finishes one instead of adding a fourth', () => {
    const draft = (title: string) => ({
      entityType: 'project' as const,
      entityId: title,
      title,
      createdAt: '2026-09-01T00:00:00Z',
      status: 'draft',
      fundedBtc: 0,
      payments: 0,
    });
    const out = formatTrackRecordForModel(
      record({ proposed: 3, entries: [draft('A'), draft('B'), draft('C')] })
    );
    expect(out).toContain('PATTERN: 3 things drafted, none published');
    expect(out).toContain('before creating anything new');
  });

  it('names the published-but-unfunded gap and the unconfirmed-proposals pattern', () => {
    const out = formatTrackRecordForModel(
      record({
        proposed: 2,
        published: 2,
        setbacks: {
          failed: 0,
          denied: 0,
          unconfirmed: 2,
          recent: [
            { actionId: 'create_event', kind: 'expired', reason: null, at: '2026-09-02T00:00:00Z' },
          ],
        },
      })
    );
    expect(out).toContain('2 published but nothing funded yet');
    expect(out).toContain('2 proposals the user never confirmed');
    expect(out).toContain('- create_event: expired (2026-09-02)');
    expect(out).toContain('Own the setbacks in the first person');
  });
});

describe('the executor runs it end to end', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the formatted record and reports the count on the chip', async () => {
    vi.doMock('@/services/cat/track-record', async () => {
      const real = await vi.importActual<typeof import('@/services/cat/track-record')>(
        '@/services/cat/track-record'
      );
      return {
        ...real,
        getCatTrackRecord: vi.fn(async () =>
          record({
            proposed: 1,
            entries: [
              {
                entityType: 'cause',
                entityId: 'c',
                title: 'Trees',
                createdAt: '2026-09-03T00:00:00Z',
                status: 'draft',
                fundedBtc: 0,
                payments: 0,
              },
            ],
          })
        ),
      };
    });
    const { executeToolCall } = await import('@/services/cat/tool-executor');
    const events: Array<Record<string, unknown>> = [];
    const result = await executeToolCall(
      {} as never,
      'user-1',
      { id: 'call-1', type: 'function', function: { name: TOOL, arguments: '{}' } } as never,
      'what have you done for me?',
      e => events.push(e as unknown as Record<string, unknown>)
    );
    expect(result.role).toBe('tool');
    expect(result.content).toContain('TRACK RECORD (last 90 days');
    expect(result.content).toContain('cause "Trees" — status draft');
    expect(events.map(e => e.status)).toEqual(['running', 'completed']);
    expect(events[1].resultCount).toBe(1);
  });

  it('fails honestly when the record cannot be derived', async () => {
    vi.doMock('@/services/cat/track-record', async () => {
      const real = await vi.importActual<typeof import('@/services/cat/track-record')>(
        '@/services/cat/track-record'
      );
      return {
        ...real,
        getCatTrackRecord: vi.fn(async () => {
          throw new Error('db down');
        }),
      };
    });
    const { executeToolCall } = await import('@/services/cat/tool-executor');
    const events: Array<Record<string, unknown>> = [];
    const result = await executeToolCall(
      {} as never,
      'user-1',
      { id: 'call-2', type: 'function', function: { name: TOOL, arguments: '{}' } } as never,
      'what have you done for me?',
      e => events.push(e as unknown as Record<string, unknown>)
    );
    expect(result.content).toContain('cannot see your history right now');
    expect(result.content).toContain('do not reconstruct it from memory');
    expect(events.map(e => e.status)).toEqual(['running', 'failed']);
  });
});
