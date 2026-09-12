/**
 * A local model's Cat can act — ADR-0008 D2.
 *
 * `/api/cat/local-complete` was 52 lines that called `saveMessages` and nothing
 * else. A model running on the user's own hardware could therefore do nothing,
 * and worse: its ```exec_action``` block was stored VERBATIM, so the user read
 * "Creating that now…" for something nothing would ever create. ADR-0006 D8
 * made the prompt honest about that limit. This makes the limit untrue instead.
 *
 * The browser holds the model; the server holds the rules. These tests pin the
 * second half — that every gate the hosted path has still applies here, and
 * that the transcript records what happened rather than what was announced.
 */
import { vi, beforeEach } from 'vitest';

const USER_ID = 'user-local-1';
const ACTOR_ID = 'actor-local-1';

// vi.hoisted, because vi.mock factories are lifted above ordinary consts and
// would read these bindings before they are initialised.
const h = vi.hoisted(() => ({
  executeAction: vi.fn(),
  saveMessages: vi.fn(),
  actorId: 'actor-local-1' as string | null,
}));
const { executeAction, saveMessages } = h;

vi.mock('@/lib/api/withAuth', () => ({
  withAuth:
    (handler: (req: unknown) => Promise<Response>) =>
    (req: unknown): Promise<Response> =>
      handler(Object.assign(req as object, { user: { id: USER_ID }, supabase: {} })),
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimitWriteAsync: vi.fn(async () => ({ success: true })),
  createRateLimitResponse: vi.fn(),
}));
vi.mock('@/services/cat/conversation-history', () => ({ saveMessages: h.saveMessages }));
vi.mock('@/domain/actors', () => ({ getUserActorId: vi.fn(async () => h.actorId) }));
vi.mock('@/services/cat', () => ({
  createActionExecutor: () => ({ executeAction: h.executeAction }),
}));
vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
// Repo convention for route tests: the response helpers return plain objects,
// so assertions read the payload directly instead of unwrapping a NextResponse.
vi.mock('@/lib/api/standardResponse', () => ({
  apiSuccess: vi.fn((data: unknown) => ({ status: 200, data })),
  apiBadRequest: vi.fn((error: string) => ({ status: 400, error })),
  apiInternalError: vi.fn((error: string) => ({ status: 500, error })),
}));

import { POST } from '@/app/api/cat/local-complete/route';
import { MAX_ACTIONS_PER_REPLY } from '@/services/cat/exec-actions';

const CONVERSATION = '11111111-1111-4111-8111-111111111111';

function execBlock(actionId: string, parameters: Record<string, unknown> = {}) {
  return (
    '```exec_action\n' + JSON.stringify({ type: 'exec_action', actionId, parameters }) + '\n```'
  );
}

async function post(body: Record<string, unknown>) {
  const req = {
    json: async () => ({
      conversationId: CONVERSATION,
      message: 'make me a project',
      model: 'local:ollama:qwen3-30b',
      ...body,
    }),
  };
  return (await (POST as unknown as (r: unknown) => Promise<unknown>)(req)) as {
    status: number;
    data: {
      saved: boolean;
      message: string;
      execResults?: Array<{ status: string; error?: string }>;
    };
  };
}

beforeEach(() => {
  executeAction.mockReset();
  saveMessages.mockReset();
  saveMessages.mockResolvedValue(undefined);
  h.actorId = ACTOR_ID;
  executeAction.mockResolvedValue({ status: 'completed', data: { id: 'p-1' } });
});

describe('the action a local model asked for actually runs', () => {
  it('goes through the executor as the authenticated user and their actor', async () => {
    const { data } = await post({
      reply: `On it.\n${execBlock('create_project', { title: 'Roof repair' })}`,
    });

    expect(executeAction).toHaveBeenCalledTimes(1);
    // The caller identity is not taken from the request body — it comes from
    // the session. A forged block cannot act for anybody else.
    expect(executeAction).toHaveBeenCalledWith(USER_ID, ACTOR_ID, {
      actionId: 'create_project',
      parameters: { title: 'Roof repair' },
    });
    expect(data.execResults?.[0]?.status).toBe('completed');
  });

  it('reports a confirmation-gated action as pending, never as done', () => {
    // The failure that matters most: Cat telling the user their project is
    // live when it is waiting on a tap.
    executeAction.mockResolvedValue({ status: 'pending_confirmation', pendingActionId: 'pa-1' });
    return post({ reply: execBlock('send_payment') }).then(({ data }) => {
      expect(data.execResults[0].status).toBe('pending_confirmation');
      expect(data.execResults[0].status).not.toBe('completed');
    });
  });

  it('survives an executor that throws, and says so', async () => {
    executeAction.mockRejectedValue(new Error('database is on fire'));
    const { status, data } = await post({ reply: execBlock('create_project') });

    expect(status).not.toBe(500);
    expect(data.execResults[0].status).toBe('failed');
    expect(data.execResults[0].error).toContain('database is on fire');
  });

  it('runs nothing when the user has no actor, rather than guessing one', async () => {
    h.actorId = null;
    const { data } = await post({ reply: execBlock('create_project') });

    expect(executeAction).not.toHaveBeenCalled();
    expect(data.execResults[0].status).toBe('failed');
  });

  it('is bounded — one reply cannot fire unlimited writes', async () => {
    // The hosted loop is bounded by the server because the server runs it. Here
    // the browser drives, so the per-reply ceiling is the bound that exists.
    const many = Array.from({ length: MAX_ACTIONS_PER_REPLY + 4 }, (_, i) =>
      execBlock('create_task', { title: `t${i}` })
    ).join('\n');
    await post({ reply: many });

    expect(executeAction).toHaveBeenCalledTimes(MAX_ACTIONS_PER_REPLY);
  });
});

describe('the transcript records what happened, not what was announced', () => {
  it('stores the reply with the envelope stripped out', async () => {
    await post({ reply: `Creating that now.\n${execBlock('create_project')}` });

    expect(saveMessages).toHaveBeenCalledTimes(1);
    const stored = saveMessages.mock.calls[0]![3] as Array<{ role: string; content: string }>;
    const assistant = stored.find(m => m.role === 'assistant')!;
    expect(assistant.content).not.toContain('exec_action');
    expect(assistant.content).not.toContain('```');
    expect(assistant.content).toContain('Creating that now.');
  });

  it('does not write a mid-loop step to history', async () => {
    // The browser posts a step, gets the outcome, and runs the model again. The
    // step is the model thinking out loud; only its final answer is transcript.
    const { data } = await post({ reply: execBlock('create_project'), intermediate: true });

    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(saveMessages).not.toHaveBeenCalled();
    expect(data.saved).toBe(false);
  });

  it('still behaves like the old route when the model just talks', async () => {
    const { data } = await post({ reply: 'Here is how I would approach that.' });

    expect(executeAction).not.toHaveBeenCalled();
    expect(saveMessages).toHaveBeenCalledTimes(1);
    expect(data.saved).toBe(true);
    expect(data.execResults).toBeUndefined();
  });
});
