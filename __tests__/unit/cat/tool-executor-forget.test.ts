/**
 * forget_memories on the TOOL-CALL dispatch path must clear BOTH stores.
 *
 * #545's commit message promised "clears BOTH stores", but the fix landed only
 * in the exec_action handler — the tool-call path silently skipped the
 * economic profile, so a "removed" skill kept driving suggestions. This suite
 * pins the both-stores contract on the path that missed it.
 */

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const mockForgetMemories = vi.fn();
vi.mock('@/services/cat/memory', () => ({
  forgetMemoriesMatching: (...args: unknown[]) => mockForgetMemories(...args),
}));

const mockRemoveProfile = vi.fn();
vi.mock('@/services/cat/economic-profile', () => ({
  removeFromEconomicProfile: (...args: unknown[]) => mockRemoveProfile(...args),
}));

import { executeToolCall } from '@/services/cat/tool-executor';

const supabase = {} as never;
const USER_ID = 'user-1';

function forgetCall(facts: unknown) {
  return {
    id: 'tc-1',
    function: { name: 'forget_memories', arguments: JSON.stringify({ facts }) },
  } as never;
}

beforeEach(() => {
  mockForgetMemories.mockReset();
  mockRemoveProfile.mockReset();
});

describe('executeToolCall forget_memories', () => {
  it('clears BOTH stores and reports the union in the tool result', async () => {
    mockForgetMemories.mockResolvedValue({
      deleted: ['Does photography'],
      notFound: ['speaks French'],
      failed: [],
    });
    mockRemoveProfile.mockResolvedValue({
      removed: ['skill: photography'],
      notFound: ['speaks French'],
      failed: [],
    });

    const events: Array<Record<string, unknown>> = [];
    const result = await executeToolCall(
      supabase,
      USER_ID,
      forgetCall(['photography', 'speaks French']),
      'forget my photography skills',
      e => events.push(e as unknown as Record<string, unknown>)
    );

    expect(mockForgetMemories).toHaveBeenCalledWith(supabase, USER_ID, [
      'photography',
      'speaks French',
    ]);
    expect(mockRemoveProfile).toHaveBeenCalledWith(supabase, USER_ID, [
      'photography',
      'speaks French',
    ]);

    const outcome = JSON.parse(result.content.split('\n')[0]);
    expect(outcome.deleted).toEqual(['Does photography']);
    expect(outcome.removedProfileEntries).toEqual(['skill: photography']);
    // notFound only lists facts BOTH stores missed.
    expect(outcome.notFound).toEqual(['speaks French']);

    const completed = events.find(e => e.status === 'completed');
    expect(completed).toBeDefined();
    // resultCount covers both stores, not just memories.
    expect(completed?.resultCount).toBe(2);
  });

  it('counts a profile-only removal as a success, not no_results', async () => {
    mockForgetMemories.mockResolvedValue({ deleted: [], notFound: ['welding'], failed: [] });
    mockRemoveProfile.mockResolvedValue({ removed: ['skill: welding'], notFound: [], failed: [] });

    const events: Array<Record<string, unknown>> = [];
    await executeToolCall(supabase, USER_ID, forgetCall(['welding']), 'forget welding', e =>
      events.push(e as unknown as Record<string, unknown>)
    );

    expect(events.some(e => e.status === 'completed')).toBe(true);
    expect(events.some(e => e.status === 'no_results')).toBe(false);
  });

  it('reports no_results only when BOTH stores found nothing', async () => {
    mockForgetMemories.mockResolvedValue({ deleted: [], notFound: ['x'], failed: [] });
    mockRemoveProfile.mockResolvedValue({ removed: [], notFound: ['x'], failed: [] });

    const events: Array<Record<string, unknown>> = [];
    await executeToolCall(supabase, USER_ID, forgetCall(['x']), 'forget x', e =>
      events.push(e as unknown as Record<string, unknown>)
    );

    expect(events.some(e => e.status === 'no_results')).toBe(true);
  });
});
