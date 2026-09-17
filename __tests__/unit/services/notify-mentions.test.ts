/**
 * Mentioning a person notified nobody.
 *
 * The `mention` notification type has existed since the notification config was
 * written — copy, icon case, type union — and nothing has ever created one. That
 * made the mention syntax decorative: you could write `@alice` and she would
 * never know.
 *
 * The rules pinned here are the ones that decide whether the notification is
 * welcome rather than noise, and one of them is a privacy rule rather than a
 * courtesy: a mention inside a PRIVATE conversation is never notified, because
 * telling a non-participant would disclose that the conversation exists, who is
 * in it, and part of what was said.
 */

const dispatch = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/notifications/dispatcher', () => ({
  NotificationDispatcher: { dispatch: (...a: unknown[]) => dispatch(...a) },
}));

import { notifyMentionedPeople } from '@/services/mentions/notify-mentions';

const admin = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: { name: 'Cato', username: 'g' }, error: null }),
      }),
    }),
  }),
} as never;

const alice = { id: 'u-alice', username: 'alice', isCat: false };
const cat = { id: 'u-cat', username: 'cat', isCat: true };

beforeEach(() => dispatch.mockClear());

describe('notifyMentionedPeople', () => {
  it('tells a mentioned person, with a link to the post', async () => {
    const sent = await notifyMentionedPeople(admin, {
      mentions: [alice],
      authorId: 'u-author',
      eventId: 'e1',
      excerpt: 'thoughts on this @alice?',
    });

    expect(sent).toBe(1);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-alice',
        type: 'mention',
        title: 'Cato mentioned you',
        actionUrl: '/posts/e1',
      })
    );
  });

  it('does not notify the Cat — it has no inbox', async () => {
    await notifyMentionedPeople(admin, {
      mentions: [cat],
      authorId: 'u-author',
      eventId: 'e1',
      excerpt: '@cat what do you think?',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not notify you about naming yourself', async () => {
    await notifyMentionedPeople(admin, {
      mentions: [alice],
      authorId: 'u-alice',
      eventId: 'e1',
      excerpt: 'as @alice I would say',
    });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('notifies each mentioned person once', async () => {
    const bob = { id: 'u-bob', username: 'bob', isCat: false };
    const sent = await notifyMentionedPeople(admin, {
      mentions: [alice, bob, cat],
      authorId: 'u-author',
      eventId: 'e1',
      excerpt: '@alice @bob @cat',
    });
    expect(sent).toBe(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('never throws when a notification fails', async () => {
    // A post is already written by this point. Losing a notification is bad;
    // losing the Cat's reply because a notification failed would be worse.
    dispatch.mockRejectedValueOnce(new Error('smtp down'));
    await expect(
      notifyMentionedPeople(admin, {
        mentions: [alice],
        authorId: 'u-author',
        eventId: 'e1',
        excerpt: 'hi @alice',
      })
    ).resolves.toBe(0);
  });

  it('quotes the post rather than sending a bare "you were mentioned"', async () => {
    await notifyMentionedPeople(admin, {
      mentions: [alice],
      authorId: 'u-author',
      eventId: 'e1',
      excerpt: '  is this funding goal realistic @alice?  ',
    });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'is this funding goal realistic @alice?' })
    );
  });
});
