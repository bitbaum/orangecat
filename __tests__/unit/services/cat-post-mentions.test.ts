/**
 * Wall posts reach the queue through a database trigger, because posts are
 * written straight from the browser to a Postgres function and there is no
 * server seam to hook. That trigger is a PREFILTER: it queues anything
 * containing the substring "@cat", so `@catalogue` arrives here too.
 *
 * The point of these tests is that the prefilter is not the rule. Detection has
 * ONE implementation — the resolver — and the worker is where its verdict is
 * applied. A second copy of "what counts as a mention", written in SQL, is
 * exactly the kind of duplication that drifts silently.
 */

const replyToPostMention = vi.fn().mockResolvedValue(true);
const resolveMentions = vi.fn();
const notifyMentionedPeople = vi.fn().mockResolvedValue(0);
const claimMentions = vi.fn();
const completeMention = vi.fn();
const failMention = vi.fn();

vi.mock('@/services/mentions/cat-account', () => ({
  ensureCatAccount: vi.fn().mockResolvedValue({ id: 'cat-1', username: 'cat' }),
}));
vi.mock('@/services/mentions/cat-post-reply', () => ({
  replyToPostMention: (...a: unknown[]) => replyToPostMention(...a),
}));
vi.mock('@/services/mentions/cat-reply', () => ({
  replyToConversationMention: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/services/mentions/resolve', () => ({
  resolveMentions: (...a: unknown[]) => resolveMentions(...a),
}));
vi.mock('@/services/mentions/notify-mentions', () => ({
  notifyMentionedPeople: (...a: unknown[]) => notifyMentionedPeople(...a),
}));
vi.mock('@/services/mentions/queue', () => ({
  claimMentions: (...a: unknown[]) => claimMentions(...a),
  completeMention: (...a: unknown[]) => completeMention(...a),
  failMention: (...a: unknown[]) => failMention(...a),
  MAX_ATTEMPTS: 3,
}));

import { runCatMentions } from '@/services/mentions/worker';

const postMention = {
  id: 'q1',
  source_type: 'timeline_event',
  source_id: 'e1',
  requester_id: 'u1',
  conversation_id: null,
  parent_event_id: 'e1',
  attempts: 1,
};

/** Admin stub returning one post's text. */
const admin = (description: string) =>
  ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { title: null, description, actor_id: 'u1' }, error: null }),
        }),
      }),
    }),
  }) as never;

beforeEach(() => {
  notifyMentionedPeople.mockClear().mockResolvedValue(0);
  replyToPostMention.mockClear().mockResolvedValue(true);
  resolveMentions.mockReset();
  claimMentions.mockReset().mockResolvedValue([postMention]);
  completeMention.mockReset();
  failMention.mockReset();
});

describe('wall-post mentions', () => {
  it('answers a post that really tags the Cat', async () => {
    resolveMentions.mockResolvedValue({
      mentions: [{ id: 'cat-1', username: 'cat', isCat: true }],
      mentionsCat: true,
    });
    const result = await runCatMentions(admin('@cat is this goal realistic?'));
    expect(replyToPostMention).toHaveBeenCalledWith(expect.anything(), {
      eventId: 'e1',
      catId: 'cat-1',
    });
    expect(result.answered).toBe(1);
  });

  it('discards the prefilter’s over-selection without replying', async () => {
    // The trigger queued this because it contains "@cat" as a substring. The
    // resolver says otherwise, and the resolver is the authority.
    resolveMentions.mockResolvedValue({ mentions: [], mentionsCat: false });
    const result = await runCatMentions(admin('browsing the @catalogue today'));
    expect(replyToPostMention).not.toHaveBeenCalled();
    expect(result.answered).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('treats a discarded mention as resolved, not failed', async () => {
    resolveMentions.mockResolvedValue({ mentions: [], mentionsCat: false });
    await runCatMentions(admin('the @catalogue'));
    // Marking it failed would retry it three times and then log an error about
    // a post that never asked the Cat anything.
    expect(completeMention).toHaveBeenCalled();
    expect(failMention).not.toHaveBeenCalled();
  });

  it('does not consult the resolver for a private-message mention', async () => {
    claimMentions.mockResolvedValue([
      { ...postMention, conversation_id: 'c1', parent_event_id: null },
    ]);
    await runCatMentions(admin('irrelevant'));
    // Those arrive through an API route that already resolved them.
    expect(resolveMentions).not.toHaveBeenCalled();
  });

  it('notifies the people a post names, even when the Cat is not among them', async () => {
    // This is the case that never worked: `@alice` in a post told alice nothing,
    // because the type existed and nothing ever created one.
    resolveMentions.mockResolvedValue({
      mentions: [{ id: 'u-alice', username: 'alice', isCat: false }],
      mentionsCat: false,
    });
    const result = await runCatMentions(admin('thoughts on this @alice?'));

    expect(notifyMentionedPeople).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventId: 'e1', authorId: 'u1' })
    );
    expect(replyToPostMention).not.toHaveBeenCalled();
    expect(result.answered).toBe(1);
  });
});
