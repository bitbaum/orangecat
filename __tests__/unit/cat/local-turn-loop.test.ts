/**
 * The browser half of ADR-0008 D2.
 *
 * The server half executes the action. Without this, it executed into a VOID:
 * the client posted the reply fire-and-forget, threw the results away, and left
 * the raw ```exec_action``` block on screen as JSON. The model never learned
 * whether anything happened, so it could not report an outcome — which is the
 * entire point of the in-turn loop (ADR-0006 D2).
 *
 * The property that matters most here is not the loop. It is that ONE GENERATED
 * REPLY IS POSTED EXACTLY ONCE: posting twice would execute its actions twice,
 * and these actions create projects and send payments.
 */
import { vi, beforeEach } from 'vitest';
import { runLocalTurn, MAX_LOCAL_PASSES } from '@/services/ai/local-turn';
import type { ExecActionResult } from '@/types/cat';

const EXEC = (actionId: string) =>
  '```exec_action\n' + JSON.stringify({ type: 'exec_action', actionId }) + '\n```';

/** A model that returns each scripted reply in turn. */
function modelSaying(...replies: string[]) {
  let i = 0;
  return vi.fn(async ({ onChunk }: { onChunk: (c: string) => void }) => {
    const reply = replies[Math.min(i, replies.length - 1)]!;
    i += 1;
    onChunk(reply);
    return reply;
  });
}

/** A server that strips the envelope and reports the given results. */
function serverReturning(results: ExecActionResult[][] = []) {
  let i = 0;
  return vi.fn(async (body: Record<string, unknown>) => {
    const reply = String(body.reply ?? '');
    const execResults = results[i] ?? [];
    i += 1;
    return {
      message: reply.replace(/```exec_action[\s\S]*?```/g, '').trim(),
      execResults,
    };
  });
}

const base = () => ({
  runtimeId: 'ollama',
  model: 'qwen3-30b',
  conversationId: 'conv-1',
  userMessage: 'make me a project',
  messages: [{ role: 'user', content: 'make me a project' }],
  onChunk: vi.fn(),
  onReplaceContent: vi.fn(),
  onToolCall: vi.fn(),
});

beforeEach(() => vi.clearAllMocks());

describe('a reply is posted exactly once', () => {
  it('never re-posts a reply that asked for an action', async () => {
    // The failure this guards: a duplicate payment, a duplicate project. The
    // server executes on every post, so the count IS the safety property.
    const stream = modelSaying(`On it.\n${EXEC('create_project')}`, 'All done.');
    const post = serverReturning([[{ actionId: 'create_project', status: 'completed' }]]);

    await runLocalTurn({ ...base(), stream, post });

    const replies = post.mock.calls.map(c => String((c[0] as Record<string, unknown>).reply));
    expect(new Set(replies).size).toBe(replies.length);
  });

  it('persists exactly one pass — the last — and marks the rest intermediate', async () => {
    const stream = modelSaying(`Working.\n${EXEC('create_project')}`, 'Created it.');
    const post = serverReturning([[{ actionId: 'create_project', status: 'completed' }]]);

    await runLocalTurn({ ...base(), stream, post });

    const flags = post.mock.calls.map(c => (c[0] as { intermediate: boolean }).intermediate);
    expect(flags).toEqual([true, false]);
    expect(flags.filter(f => f === false)).toHaveLength(1);
  });
});

describe('the model learns what actually happened', () => {
  it('feeds the outcome back and runs again', async () => {
    const stream = modelSaying(`Doing it.\n${EXEC('create_project')}`, 'Your project is live.');
    const post = serverReturning([
      [{ actionId: 'create_project', status: 'completed', displayMessage: 'Roof repair' }],
    ]);

    const out = await runLocalTurn({ ...base(), stream, post });

    expect(stream).toHaveBeenCalledTimes(2);
    const secondPass = stream.mock.calls[1]![0] as { messages: Array<{ content: string }> };
    const fed = secondPass.messages.map(m => m.content).join('\n');
    expect(fed).toContain('create_project: done.');
    expect(out.message).toBe('Your project is live.');
  });

  it('tells the model a pending action is NOT done', async () => {
    // The worst outcome is Cat announcing a payment that is still waiting on a
    // tap. The model writes its reply from this text, so it must not read done.
    const stream = modelSaying(`Sending.\n${EXEC('send_payment')}`, 'Waiting on you.');
    const post = serverReturning([
      [{ actionId: 'send_payment', status: 'pending_confirmation', pendingActionId: 'pa-1' }],
    ]);

    await runLocalTurn({ ...base(), stream, post });

    const fed = (stream.mock.calls[1]![0] as { messages: Array<{ content: string }> }).messages
      .map(m => m.content)
      .join('\n');
    expect(fed).toContain('NOT done yet');
    expect(fed).not.toMatch(/send_payment: done/);
  });

  it('says nothing ran when the block could not be read', async () => {
    // A malformed fence: the client saw one, the server parsed none. Silence
    // here would let the model claim success for work that never happened.
    const stream = modelSaying(`Here goes.\n${EXEC('create_project')}`, 'I could not do that.');
    const post = serverReturning([[]]);

    await runLocalTurn({ ...base(), stream, post });

    const fed = (stream.mock.calls[1]![0] as { messages: Array<{ content: string }> }).messages
      .map(m => m.content)
      .join('\n');
    expect(fed).toContain('NOTHING ran');
  });
});

describe('what the user sees', () => {
  it('replaces the raw envelope with the parsed text', async () => {
    const stream = modelSaying(`Creating that now.\n${EXEC('create_project')}`, 'Done.');
    const post = serverReturning([[{ actionId: 'create_project', status: 'completed' }]]);
    const params = { ...base(), stream, post };

    await runLocalTurn(params);

    // The stream put the envelope on screen; every settle must remove it.
    const settled = params.onReplaceContent.mock.calls.map(c => String(c[0]));
    expect(settled.length).toBeGreaterThan(0);
    for (const text of settled) {
      expect(text).not.toContain('exec_action');
    }
  });

  it('emits a chip per action, and never upgrades its status', async () => {
    const stream = modelSaying(`${EXEC('send_payment')}`, 'Waiting.');
    const post = serverReturning([
      [
        { actionId: 'send_payment', status: 'pending_confirmation' },
        { actionId: 'create_task', status: 'failed', error: 'nope' },
      ],
    ]);
    const params = { ...base(), stream, post };

    const out = await runLocalTurn(params);

    expect(params.onToolCall).toHaveBeenCalledTimes(2);
    const statuses = out.toolCalls.map(t => t.status);
    expect(statuses).toEqual(['pending_confirmation', 'failed']);
    expect(statuses).not.toContain('completed');
    // Ids must be distinct or the merge-by-id in the hook collapses them.
    expect(new Set(out.toolCalls.map(t => t.id)).size).toBe(2);
  });
});

describe('the loop is bounded', () => {
  it('stops after MAX_LOCAL_PASSES even if the model keeps asking', async () => {
    // Every pass is seconds of local inference the user waits through.
    const stream = modelSaying(EXEC('create_task'));
    const post = serverReturning(
      Array.from({ length: 10 }, () => [{ actionId: 'create_task', status: 'completed' as const }])
    );

    await runLocalTurn({ ...base(), stream, post });

    expect(stream).toHaveBeenCalledTimes(MAX_LOCAL_PASSES);
    // And the final pass must still persist, or the turn is lost from history.
    const flags = post.mock.calls.map(c => (c[0] as { intermediate: boolean }).intermediate);
    expect(flags[flags.length - 1]).toBe(false);
  });

  it('does not loop at all when the model just talks', async () => {
    const stream = modelSaying('Here is how I would approach that.');
    const post = serverReturning([]);

    const out = await runLocalTurn({ ...base(), stream, post });

    expect(stream).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
    expect((post.mock.calls[0]![0] as { intermediate: boolean }).intermediate).toBe(false);
    expect(out.toolCalls).toEqual([]);
  });
});
