/**
 * Cat acts inside the turn, and says true things about it.
 *
 * ADR-0006 D2. Before this loop, actions were scraped out of the model's
 * FINISHED text and fired afterwards, so the system prompt had to carry a rule
 * the model could not verify — "announce it as in progress… NEVER as already
 * done". Now the result comes back before the model writes.
 *
 * That moves the risk. The dangerous failure is no longer "the action didn't
 * run"; it is **the model being told something worked when it did not**, and
 * then telling the user. So most of these tests are about the exact wording
 * handed back, because that wording is what the reply is built from.
 */

import { vi } from 'vitest';
import {
  runActionStep,
  shouldContinue,
  summariseForModel,
  toolsForTurn,
  MAX_ACTION_STEPS,
} from '@/services/cat/action-loop';

const call = (name: string, args: Record<string, unknown> = {}, id = 'call-1') => ({
  id,
  name,
  arguments: args,
});

describe('what the model is told', () => {
  it('says DONE only when it is done', () => {
    const summary = summariseForModel('create_project', {
      status: 'completed',
      data: { displayMessage: 'Project "Studio" created', id: 'p-1' },
    });
    expect(summary).toContain('DONE');
    expect(summary).toContain('Studio');
    expect(summary).toContain('p-1');
  });

  it('never lets a pending confirmation read as success', () => {
    // The user has not tapped anything yet. A model that reads this as "done"
    // tells them their project is live when it is waiting on them.
    const summary = summariseForModel('create_project', { status: 'pending_confirmation' });
    expect(summary).toMatch(/WAITING FOR THE USER/);
    expect(summary).toMatch(/[Nn]othing has been created/);
    expect(summary).not.toContain('DONE');
  });

  it('tells the model not to retry a denial', () => {
    const summary = summariseForModel('send_payment', {
      status: 'denied',
      error: 'Permission denied',
    });
    expect(summary).toContain('NOT PERMITTED');
    expect(summary).toMatch(/[Dd]o not retry/);
  });

  it('allows exactly one correction after a failure', () => {
    const summary = summariseForModel('create_product', {
      status: 'failed',
      error: 'price_btc: Required',
    });
    expect(summary).toContain('FAILED');
    expect(summary).toContain('price_btc');
    expect(summary).toMatch(/try once more/);
  });
});

describe('runActionStep', () => {
  it('executes through the runner and summarises the outcome', async () => {
    const run = vi.fn().mockResolvedValue({ status: 'completed', data: { id: 'p-1' } });

    const results = await runActionStep([call('create_project', { title: 'Studio' })], run);

    expect(run).toHaveBeenCalledWith({
      actionId: 'create_project',
      parameters: { title: 'Studio' },
    });
    expect(results[0]).toMatchObject({ actionId: 'create_project', status: 'completed' });
    expect(results[0].summary).toContain('DONE');
  });

  it('runs calls in order, so the second can depend on the first', async () => {
    const order: string[] = [];
    const run = vi.fn().mockImplementation(async ({ actionId }: { actionId: string }) => {
      order.push(actionId);
      return { status: 'completed' as const };
    });

    await runActionStep(
      [call('create_project', {}, 'a'), call('publish_entity', {}, 'b')],
      run
    );

    // Parallel execution would mean publish could not see the create — the
    // exact defect the loop exists to remove.
    expect(order).toEqual(['create_project', 'publish_entity']);
  });

  it('refuses an action that is not in the registry', async () => {
    const run = vi.fn();
    const results = await runActionStep([call('drop_all_tables')], run);

    expect(run).not.toHaveBeenCalled();
    expect(results[0].status).toBe('failed');
    expect(results[0].summary).toContain('Unknown action');
  });

  it('turns a thrown handler into a failed step, not a dead turn', async () => {
    const run = vi.fn().mockRejectedValue(new Error('database on fire'));

    const results = await runActionStep([call('create_project')], run);

    expect(results[0].status).toBe('failed');
    expect(results[0].summary).toContain('database on fire');
  });

  it('keeps the tool call id, so results map back to their calls', async () => {
    const run = vi.fn().mockResolvedValue({ status: 'completed' });
    const results = await runActionStep([call('create_project', {}, 'tc-42')], run);
    expect(results[0].toolCallId).toBe('tc-42');
  });
});

describe('shouldContinue', () => {
  it('stops when a step needs the user to confirm', () => {
    // Continuing would queue writes behind a decision the user has not made.
    expect(
      shouldContinue([{ toolCallId: 'a', actionId: 'x', status: 'pending_confirmation', summary: '' }], 1)
    ).toBe(false);
  });

  it('continues after a completed step', () => {
    expect(
      shouldContinue([{ toolCallId: 'a', actionId: 'x', status: 'completed', summary: '' }], 1)
    ).toBe(true);
  });

  it('continues after a failure, so the model can correct itself', () => {
    expect(
      shouldContinue([{ toolCallId: 'a', actionId: 'x', status: 'failed', summary: '' }], 1)
    ).toBe(true);
  });

  it('stops at the step ceiling regardless', () => {
    expect(
      shouldContinue(
        [{ toolCallId: 'a', actionId: 'x', status: 'completed', summary: '' }],
        MAX_ACTION_STEPS
      )
    ).toBe(false);
  });
});

describe('toolsForTurn', () => {
  it('offers only the granted actions', () => {
    const tools = toolsForTurn(['create_project', 'publish_entity']);
    expect(tools.map(t => t.function.name).sort()).toEqual(['create_project', 'publish_entity']);
  });

  it('offers nothing when nothing is granted', () => {
    // A user who has granted no capabilities must not be shown a menu of
    // things Cat will then be refused permission to do.
    expect(toolsForTurn([])).toEqual([]);
  });
});
