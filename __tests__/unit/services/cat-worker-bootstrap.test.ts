/**
 * The Cat has to be able to come into existence.
 *
 * There is a circularity hiding in this feature, and the first version shipped
 * into it: `resolveMentions` can only flag @cat when a Cat PROFILE exists, so
 * with no account nothing is ever queued — and if the account were only
 * established when something was queued, nothing ever would be. A freshly
 * deployed platform would sit there with @cat resolving to nobody, looking
 * exactly like a working feature nobody had used yet.
 *
 * So the worker establishes the account BEFORE it looks at the queue, and
 * before the empty-queue exit. This test is the thing that stops that ordering
 * from being "tidied up" later.
 */

const ensureCatAccount = vi.fn();
const claimMentions = vi.fn();

vi.mock('@/services/mentions/cat-account', () => ({
  ensureCatAccount: (...a: unknown[]) => ensureCatAccount(...a),
}));
vi.mock('@/services/mentions/queue', () => ({
  claimMentions: (...a: unknown[]) => claimMentions(...a),
  completeMention: vi.fn(),
  failMention: vi.fn(),
  MAX_ATTEMPTS: 3,
}));
vi.mock('@/services/mentions/cat-reply', () => ({
  replyToConversationMention: vi.fn().mockResolvedValue(true),
}));

import { runCatMentions } from '@/services/mentions/worker';

beforeEach(() => {
  ensureCatAccount.mockReset().mockResolvedValue({ id: 'cat-1', username: 'cat' });
  claimMentions.mockReset().mockResolvedValue([]);
});

describe('the mention worker bootstraps the Cat', () => {
  it('establishes the account even when the queue is empty', async () => {
    await runCatMentions({} as never);
    // The empty queue is the NORMAL state, and it is exactly the state a new
    // deployment is in. Returning early without this call is the deadlock.
    expect(ensureCatAccount).toHaveBeenCalledTimes(1);
  });

  it('establishes the account before it claims anything', async () => {
    const order: string[] = [];
    ensureCatAccount.mockImplementation(async () => {
      order.push('ensure');
      return { id: 'cat-1', username: 'cat' };
    });
    claimMentions.mockImplementation(async () => {
      order.push('claim');
      return [];
    });

    await runCatMentions({} as never);
    expect(order).toEqual(['ensure', 'claim']);
  });

  it('still reports an empty run as empty', async () => {
    await expect(runCatMentions({} as never)).resolves.toEqual({
      claimed: 0,
      answered: 0,
      failed: 0,
    });
  });

  it('answers a claimed mention once the account exists', async () => {
    claimMentions.mockResolvedValue([
      {
        id: 'q1',
        source_type: 'message',
        source_id: 'm1',
        requester_id: 'u1',
        conversation_id: 'c1',
        parent_event_id: null,
        attempts: 1,
      },
    ]);
    await expect(runCatMentions({} as never)).resolves.toMatchObject({ claimed: 1, answered: 1 });
  });

  it('fails claimed mentions rather than speaking as nobody', async () => {
    ensureCatAccount.mockResolvedValue(null);
    claimMentions.mockResolvedValue([
      {
        id: 'q1',
        source_type: 'message',
        source_id: 'm1',
        requester_id: 'u1',
        conversation_id: 'c1',
        parent_event_id: null,
        attempts: 1,
      },
    ]);
    await expect(runCatMentions({} as never)).resolves.toMatchObject({ failed: 1, answered: 0 });
  });
});
