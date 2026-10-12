/**
 * Turning candidate handles into real accounts — including the Cat.
 *
 * The Cat is resolved by the same code path as everybody else, because it is an
 * account like everybody else. That is the whole point of giving it a profile
 * rather than special-casing its replies: there is one mention system, and
 * `mentionsCat` is a fact about the result, not a separate mechanism.
 */

import { resolveMentions } from '@/services/mentions/resolve';

/** Minimal stand-in for the PostgREST builder chain, capturing the filter. */
function clientReturning(rows: Array<{ id: string; username: string }>) {
  const captured: { column?: string; values?: string[] } = {};
  const client = {
    from: () => ({
      select: () => ({
        in: (column: string, values: string[]) => {
          captured.column = column;
          captured.values = values;
          return {
            limit: () =>
              Promise.resolve({
                data: rows.filter(r => values.includes(r.username.toLowerCase())),
                error: null,
              }),
          };
        },
      }),
    }),
  };
  return { client: client as never, captured };
}

describe('resolveMentions', () => {
  it('resolves a plain mention', async () => {
    const { client } = clientReturning([{ id: 'u1', username: 'alice' }]);
    const result = await resolveMentions(client, 'hey @alice');
    expect(result.mentions).toEqual([{ id: 'u1', username: 'alice', isCat: false }]);
    expect(result.mentionsCat).toBe(false);
  });

  it('flags the Cat without a separate code path', async () => {
    const { client } = clientReturning([{ id: 'cat-id', username: 'cat' }]);
    const result = await resolveMentions(client, '@cat what do you think about this?');
    expect(result.mentionsCat).toBe(true);
    expect(result.mentions[0]).toMatchObject({ id: 'cat-id', isCat: true });
  });

  it('matches case-insensitively, because @Cat is the same account', async () => {
    const { client } = clientReturning([{ id: 'cat-id', username: 'cat' }]);
    const result = await resolveMentions(client, 'hey @Cat');
    expect(result.mentionsCat).toBe(true);
  });

  it('queries the generated column, in one round trip for the whole message', async () => {
    const { client, captured } = clientReturning([
      { id: 'u1', username: 'alice' },
      { id: 'u2', username: 'bob' },
    ]);
    await resolveMentions(client, '@alice @bob @alice');
    // A functional index cannot be filtered on through PostgREST; the generated
    // column is what makes this a single case-insensitive lookup.
    expect(captured.column).toBe('username_lower');
    expect(captured.values).toEqual(expect.arrayContaining(['alice', 'bob']));
  });

  it('prefers the longest real handle', async () => {
    // Both exist; `@bob.smith` means bob.smith, not bob.
    const { client } = clientReturning([
      { id: 'u-long', username: 'bob.smith' },
      { id: 'u-short', username: 'bob' },
    ]);
    const result = await resolveMentions(client, 'ping @bob.smith');
    expect(result.mentions).toHaveLength(1);
    expect(result.mentions[0].id).toBe('u-long');
  });

  it('falls back to the shorter handle when the longer one is nobody', async () => {
    const { client } = clientReturning([{ id: 'u-short', username: 'bob' }]);
    const result = await resolveMentions(client, 'ping @bob.and.alice');
    expect(result.mentions[0].id).toBe('u-short');
  });

  it('mentions a person once even if named twice', async () => {
    const { client } = clientReturning([{ id: 'u1', username: 'alice' }]);
    const result = await resolveMentions(client, '@alice @Alice @alice');
    expect(result.mentions).toHaveLength(1);
  });

  it('returns nothing for a handle that belongs to no one', async () => {
    const { client } = clientReturning([]);
    const result = await resolveMentions(client, '@nobody_at_all');
    expect(result.mentions).toEqual([]);
    expect(result.mentionsCat).toBe(false);
  });

  it('does not query at all when there is nothing to resolve', async () => {
    const { client, captured } = clientReturning([{ id: 'u1', username: 'alice' }]);
    const result = await resolveMentions(client, 'no handles here, email bob@example.com');
    expect(result.mentions).toEqual([]);
    expect(captured.column).toBeUndefined();
  });
});
