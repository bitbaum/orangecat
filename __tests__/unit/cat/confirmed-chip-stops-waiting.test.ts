/**
 * A chip must stop saying "needs your confirmation" once you have confirmed it.
 *
 * The chip was terminal. `action-as-tool` emits `pending_confirmation` during
 * the streaming turn; that stream then closes, and the confirm request goes to
 * a plain JSON route that emits no tool_call event. Nothing existed to update
 * it, so the chat kept claiming a payment was waiting for a tap after the user
 * had tapped — and on reload the chip vanished instead of resolving.
 *
 * Worse, it could not have been updated even if something tried. The event
 * carried only the provider's tool-call id and the action name; the confirm
 * card knows only the pending-action row id, and the confirm route echoes
 * neither. There was NO correlation key. `pendingActionId` is that key, and
 * these tests pin both halves: that it is emitted, and that it is what the
 * client matches on.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { vi, beforeEach } from 'vitest';

const executeAction = vi.hoisted(() => vi.fn());
vi.mock('@/services/cat/action-executor', () => ({
  CatActionExecutor: class {
    executeAction = executeAction;
  },
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { runActionAsTool } from '@/services/cat/action-as-tool';
import { labelForTool } from '@/lib/chat/tool-labels';
import type { ToolCallEvent } from '@/services/cat/tool-use-types';

const supabase = {} as never;
const call = (name: string) => ({
  id: 'tc-1',
  type: 'function' as const,
  function: { name, arguments: '{}' },
});

beforeEach(() => executeAction.mockReset());

describe('the key that makes a chip findable', () => {
  it('is emitted with the pending event, not dropped', async () => {
    // It WAS dropped: the executor returned pendingActionId and the emitter
    // built the event without it, so the row the card would confirm was never
    // named on the chip that was waiting for it.
    executeAction.mockResolvedValue({ status: 'pending_confirmation', pendingActionId: 'pa-7' });
    const events: ToolCallEvent[] = [];

    await runActionAsTool(supabase, 'u1', 'a1', call('send_payment'), e => events.push(e));

    const pending = events.find(e => e.status === 'pending_confirmation');
    expect(pending).toBeDefined();
    expect(pending && 'pendingActionId' in pending && pending.pendingActionId).toBe('pa-7');
  });

  it('is absent on outcomes that are not waiting for anything', async () => {
    executeAction.mockResolvedValue({ status: 'completed', data: {} });
    const events: ToolCallEvent[] = [];

    await runActionAsTool(supabase, 'u1', 'a1', call('create_project'), e => events.push(e));

    const done = events.find(e => e.status === 'completed');
    expect(done).toBeDefined();
    expect(done && 'pendingActionId' in done).toBe(false);
  });
});

/**
 * The resolver is a pure transform over one message's toolCalls, mirrored here
 * so the matching rule is testable without mounting React. If it drifts from
 * `resolvePendingChip`, the source gate below fails.
 */
function resolve(
  toolCalls: ToolCallEvent[],
  pendingActionId: string,
  outcome: { status: 'completed' | 'declined' | 'failed'; error?: string }
): ToolCallEvent[] {
  const waitingFor = (t: ToolCallEvent) =>
    t.status === 'pending_confirmation' && t.pendingActionId === pendingActionId;
  return toolCalls.map(t => {
    if (!waitingFor(t)) {
      return t;
    }
    if (outcome.status === 'completed') {
      return { id: t.id, name: t.name, status: 'completed' as const, resultCount: 1, results: [] };
    }
    return outcome.status === 'declined'
      ? { id: t.id, name: t.name, status: 'declined' as const }
      : { id: t.id, name: t.name, status: 'failed' as const, error: outcome.error };
  });
}

const waiting = (id: string, name: string, pendingActionId: string): ToolCallEvent => ({
  id,
  name,
  status: 'pending_confirmation',
  pendingActionId,
});

describe('confirming settles the right chip', () => {
  it('stops the chip claiming it is still waiting', () => {
    const out = resolve([waiting('tc-1', 'send_payment', 'pa-7')], 'pa-7', {
      status: 'completed',
    });
    expect(out[0]!.status).toBe('completed');
    expect(labelForTool(out[0]!.name).completed(1)).toBe('Sent payment');
  });

  it('settles by the row id and NEVER by the action name', () => {
    // Two payments waiting at once is the case that makes name-matching
    // dangerous: settling the wrong one tells the user a payment went through
    // when a different payment did.
    const out = resolve(
      [waiting('tc-1', 'send_payment', 'pa-7'), waiting('tc-2', 'send_payment', 'pa-8')],
      'pa-8',
      { status: 'completed' }
    );
    expect(out.map(t => t.status)).toEqual(['pending_confirmation', 'completed']);
    expect(out[1]!.id).toBe('tc-2');
  });

  it('leaves unrelated chips exactly as they were', () => {
    const search: ToolCallEvent = {
      id: 'tc-9',
      name: 'web_search',
      status: 'completed',
      resultCount: 3,
      results: [],
    };
    const out = resolve([search, waiting('tc-1', 'send_payment', 'pa-7')], 'pa-7', {
      status: 'completed',
    });
    expect(out[0]).toBe(search);
  });
});

describe('declining is not failing', () => {
  it('renders as a choice the user made, not as something broken', () => {
    // `pending_confirmation` exists because sending a waiting action as
    // 'failed' made the chat read "Action failed" above a card waiting for a
    // tap. Collapsing a DECLINE into 'failed' repeats that one step later:
    // "Couldn't send payment" is untrue — nothing tried and nothing broke.
    const out = resolve([waiting('tc-1', 'send_payment', 'pa-7')], 'pa-7', {
      status: 'declined',
    });
    expect(out[0]!.status).toBe('declined');
    expect(labelForTool('send_payment').declined).toBe('Send payment — declined');
    expect(labelForTool('send_payment').declined).not.toContain("Couldn't");
  });

  it('gives every action its own declined wording, derived like the rest', () => {
    expect(labelForTool('create_project').declined).toBe('Create project — declined');
    expect(labelForTool('send_to_fleetcrown').declined).toBe('Send to FleetCrown — declined');
  });

  it('still reports a genuine failure as a failure', () => {
    const out = resolve([waiting('tc-1', 'send_payment', 'pa-7')], 'pa-7', {
      status: 'failed',
      error: 'wallet unreachable',
    });
    expect(out[0]!.status).toBe('failed');
    expect(out[0] && 'error' in out[0] && out[0].error).toBe('wallet unreachable');
  });
});

describe('the mirrored rule has not drifted from the real one', () => {
  // `resolve()` above is a copy of `resolvePendingChip`, kept so the matching
  // rule is testable without mounting React. A copy that drifts in silence is
  // the failure this whole file exists to prevent, so the copy is tied to the
  // original here rather than trusted.
  const src = readFileSync(
    join(__dirname, '../../../src/components/ai-chat/ModernChatPanel/hooks/useChatMessages.ts'),
    'utf8'
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ');

  it('matches on the row id, narrowed by the waiting status', () => {
    expect(src).toContain(
      "t.status === 'pending_confirmation' && t.pendingActionId === pendingActionId"
    );
  });

  it('is actually called when the user answers the card', () => {
    // A resolver nothing calls is decoration — the chip would still be stale.
    const panel = readFileSync(
      join(__dirname, '../../../src/components/ai-chat/ModernChatPanel/index.tsx'),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(panel).toContain("resolvePendingChip(action.id, { status: 'completed' })");
    expect(panel).toContain("resolvePendingChip(actionId, { status: 'declined' })");
  });

  it('keeps a decline out of the failed branch', () => {
    expect(src).toContain("outcome.status === 'declined'");
    expect(src).toContain("status: 'declined' as const");
  });
});
