import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PLATFORM_TOOL_DEFINITION } from '@/services/cat/tool-use-detection';
import { isCatActionTool } from '@/services/cat/action-as-tool';
import { formatTrackRecordForModel, type CatTrackRecord } from '@/services/cat/track-record';
import { labelForTool } from '@/lib/chat/tool-labels';

/**
 * ADR-0006 D6 — Cat can check its own work.
 *
 * Wiring (executor dispatch) is owned by the platform tool list + label module.
 * This file pins the definition contract and formatTrackRecordForModel behaviour.
 */

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

describe('check_my_track_record is a platform read tool', () => {
  it('is offered as a zero-argument tool definition', () => {
    const def = PLATFORM_TOOL_DEFINITION.find(t => t.function.name === TOOL);
    expect(def).toBeDefined();
    expect(def!.function.parameters).toEqual({ type: 'object', properties: {} });
    expect(def!.function.description).toContain('query_my_data');
  });

  it('is a read tool, so the action registry never claims the name', () => {
    expect(isCatActionTool(TOOL)).toBe(false);
  });

  it('has its own chip wording, not borrowed search copy', () => {
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
