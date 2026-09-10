/**
 * An action called as a tool runs through the executor, and the model is told
 * the truth about it.
 *
 * ADR-0006 D2, the wiring. `executeToolCall` now recognises a Cat action id as
 * a tool name and executes it — before the model writes its reply, so the
 * outcome is in the messages the reply is built from.
 *
 * The gates did not move. Permissions, spend caps, confirmation and the
 * `cat_action_log` row all still live in `CatActionExecutor`; this only changes
 * WHEN the model learns the outcome. These tests pin that, and pin the failure
 * that would be worst: an action that did not happen reading back as one that
 * did, so Cat tells the user their project is live when it is waiting on a tap.
 */

import { vi, beforeEach } from 'vitest';

const executeAction = vi.fn();
vi.mock('@/services/cat/action-executor', () => ({
  CatActionExecutor: class {
    executeAction = executeAction;
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { executeToolCall } from '@/services/cat/tool-executor';

const supabase = {} as never;
const call = (name: string, args: unknown = {}) => ({
  id: 'tc-1',
  type: 'function' as const,
  function: { name, arguments: JSON.stringify(args) },
});

beforeEach(() => {
  executeAction.mockReset();
});

describe('an action called as a tool', () => {
  it('goes through the executor with the caller and their actor', async () => {
    executeAction.mockResolvedValue({ status: 'completed', data: { id: 'p-1' } });

    const msg = await executeToolCall(
      supabase,
      'user-1',
      call('create_project', { title: 'Studio' }),
      'make me a studio project',
      undefined,
      undefined,
      'actor-1'
    );

    // The executor is where every gate lives — permissions, spend caps,
    // confirmation, the audit row. Bypassing it would be the whole risk.
    expect(executeAction).toHaveBeenCalledWith('user-1', 'actor-1', {
      actionId: 'create_project',
      parameters: { title: 'Studio' },
    });
    expect(msg.role).toBe('tool');
    expect(msg.tool_call_id).toBe('tc-1');
    expect(msg.content).toContain('DONE');
  });

  it('never lets a pending confirmation read as done', async () => {
    executeAction.mockResolvedValue({ status: 'pending_confirmation', pendingActionId: 'pa-1' });

    const msg = await executeToolCall(
      supabase,
      'user-1',
      call('create_project', { title: 'Studio' }),
      'make me a studio',
      undefined,
      undefined,
      'actor-1'
    );

    expect(msg.content).toMatch(/WAITING FOR THE USER/);
    expect(msg.content).not.toContain('DONE');
  });

  it('reports a denial as a denial', async () => {
    executeAction.mockResolvedValue({ status: 'denied', error: 'Permission denied' });

    const msg = await executeToolCall(
      supabase,
      'user-1',
      call('send_payment', { amount_btc: 0.1 }),
      'pay them',
      undefined,
      undefined,
      'actor-1'
    );

    expect(msg.content).toContain('NOT PERMITTED');
  });

  it('refuses to act without an actor rather than pretending', async () => {
    const msg = await executeToolCall(
      supabase,
      'user-1',
      call('create_project', { title: 'Studio' }),
      'make me a studio',
      undefined,
      undefined,
      null
    );

    expect(executeAction).not.toHaveBeenCalled();
    expect(msg.content).toContain('FAILED');
  });

  it('turns malformed arguments into a correctable message, not a crash', async () => {
    const bad = {
      id: 'tc-2',
      type: 'function' as const,
      function: { name: 'create_project', arguments: '{not json' },
    };

    const msg = await executeToolCall(supabase, 'user-1', bad, 'go', undefined, undefined, 'a-1');

    expect(executeAction).not.toHaveBeenCalled();
    expect(msg.content).toContain('JSON');
  });

  it('survives a thrown executor', async () => {
    executeAction.mockRejectedValue(new Error('database on fire'));

    const msg = await executeToolCall(
      supabase,
      'user-1',
      call('create_project', { title: 'x' }),
      'go',
      undefined,
      undefined,
      'actor-1'
    );

    // A failed action must leave the model able to tell the user, which beats
    // a dead stream.
    expect(msg.content).toContain('database on fire');
  });

  it('emits a failed tool event for a pending confirmation, not a completed one', async () => {
    // The client renders these live. A green tick on something the user still
    // has to approve is the UI version of the same lie.
    executeAction.mockResolvedValue({ status: 'pending_confirmation' });
    const events: { status: string }[] = [];

    await executeToolCall(
      supabase,
      'user-1',
      call('create_project', { title: 'x' }),
      'go',
      e => events.push(e as { status: string }),
      undefined,
      'actor-1'
    );

    expect(events.map(e => e.status)).toEqual(['running', 'failed']);
  });
});

/**
 * `forget_memories` is defined BOTH as a platform read tool and as a registry
 * action, and the two are not equivalent — the tool clears the memory store
 * AND the profile and reports the union; the action does less.
 *
 * When the action branch was added it checked the registry first, which
 * silently rerouted every forget to the weaker implementation. Three existing
 * tests caught it. This pins the resolution so a future name collision fails
 * here, loudly, instead of quietly downgrading a user's request.
 */
describe('a name owned by both worlds', () => {
  it('is handled by the read tool, not the action registry', async () => {
    executeAction.mockResolvedValue({ status: 'completed' });

    await executeToolCall(
      supabase,
      'user-1',
      call('forget_memories', { facts: ['I speak French'] }),
      'forget that',
      undefined,
      undefined,
      'actor-1'
    );

    expect(executeAction).not.toHaveBeenCalled();
  });
});
