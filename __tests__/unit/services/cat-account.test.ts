/**
 * The Cat needs a row before it can speak.
 *
 * Everything else about tagging depends on the Cat being an ordinary account:
 * that is what lets a Cat reply be an ordinary message row, with no branch in
 * read receipts, search, threading or realtime. So this is the one piece that
 * cannot be "handled in the renderer".
 *
 * The behaviours pinned here are the ones that decide whether it is safe to run
 * on every tick: it must not create a second Cat, it must recover from a
 * half-built account, and it must refuse rather than improvise when it cannot
 * establish one — a caller that gets null must not invent a sender.
 *
 * Recovering from a RENAME is here because the suite below used to cover only
 * a deleted profile, and production broke the other way: on 2026-08-26 the
 * email-derived-handle retirement renamed the Cat from `cat` to
 * `user_0234d5e38e66`, this file searched by username, found nothing, and
 * returned null on every tick for two days. Self-healing that keys on the field
 * most likely to break heals nothing.
 */

import { ensureCatAccount } from '@/services/mentions/cat-account';

type Row = { id: string; username: string } | null;

function adminWith({
  profile,
  createError,
  profileAfterCreate,
  updateError,
}: {
  profile: Row;
  createError?: { message: string };
  profileAfterCreate?: Row;
  updateError?: { message: string };
}) {
  const createUser = vi.fn().mockResolvedValue({ error: createError ?? null });
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: updateError ?? null }),
  }));
  let lookups = 0;
  const lookupColumns: string[] = [];

  const admin = {
    auth: { admin: { createUser } },
    from: () => ({
      select: () => ({
        eq: (column: string) => {
          lookupColumns.push(column);
          return {
            maybeSingle: () => {
              lookups += 1;
              const row = lookups === 1 ? profile : (profileAfterCreate ?? profile);
              return Promise.resolve({ data: row, error: null });
            },
          };
        },
      }),
      update,
    }),
  };
  return {
    admin: admin as never,
    createUser,
    update,
    lookups: () => lookups,
    lookupColumns,
  };
}

describe('ensureCatAccount', () => {
  it('returns the existing account without creating a second one', async () => {
    const { admin, createUser } = adminWith({ profile: { id: 'cat-1', username: 'cat' } });
    await expect(ensureCatAccount(admin)).resolves.toEqual({ id: 'cat-1', username: 'cat' });
    expect(createUser).not.toHaveBeenCalled();
  });

  it('creates the account with an address nobody can ever receive mail at', async () => {
    const { admin, createUser } = adminWith({
      profile: null,
      profileAfterCreate: { id: 'cat-1', username: 'cat' },
    });
    await ensureCatAccount(admin);

    const [args] = createUser.mock.calls[0];
    // .invalid is reserved by RFC 2606. An account's email is its password-reset
    // channel, so a bot identity with a routable address is one somebody can
    // eventually take.
    expect(args.email).toMatch(/@orangecat\.invalid$/);
    expect(args.email.split('@')[0]).toBe('cat');
    // No password is set, so it cannot be signed into with one.
    expect(args.password).toBeUndefined();
  });

  it('recovers when the auth user already exists but the profile was deleted', async () => {
    const { admin } = adminWith({
      profile: null,
      createError: { message: 'A user with this email address has already been registered' },
      profileAfterCreate: { id: 'cat-1', username: 'cat' },
    });
    // The auth user survives a deleted profile row, so "already registered" is
    // the expected path on a re-run, not a failure.
    await expect(ensureCatAccount(admin)).resolves.toEqual({ id: 'cat-1', username: 'cat' });
  });

  it('refuses rather than improvising when creation genuinely fails', async () => {
    const { admin } = adminWith({
      profile: null,
      createError: { message: 'database is on fire' },
    });
    await expect(ensureCatAccount(admin)).resolves.toBeNull();
  });

  it('refuses when the auth user exists but no profile ever appears', async () => {
    const { admin } = adminWith({ profile: null, profileAfterCreate: null });
    await expect(ensureCatAccount(admin)).resolves.toBeNull();
  });

  it('describes the account so a half-built one converges', async () => {
    const { admin, update } = adminWith({
      profile: null,
      profileAfterCreate: { id: 'cat-1', username: 'cat' },
    });
    await ensureCatAccount(admin);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Cat' }));
  });

  it('finds the Cat by its login address, not by the handle that can be taken away', async () => {
    const { admin, lookupColumns } = adminWith({
      profile: { id: 'cat-1', username: 'cat' },
    });
    await ensureCatAccount(admin);

    // Searching by `username` is what made the 2026-08-26 rename unrecoverable:
    // the field being repaired was the field being searched by.
    expect(lookupColumns).toContain('email');
    expect(lookupColumns).not.toContain('username');
  });

  it('restores the handle when something has renamed the Cat', async () => {
    const { admin, update } = adminWith({
      profile: { id: 'cat-1', username: 'user_0234d5e38e66' },
    });

    await expect(ensureCatAccount(admin)).resolves.toEqual({
      id: 'cat-1',
      username: 'cat',
    });
    expect(update).toHaveBeenCalledWith({ username: 'cat' });
  });

  it('does not write on an ordinary tick', async () => {
    const { admin, update } = adminWith({ profile: { id: 'cat-1', username: 'cat' } });
    await ensureCatAccount(admin);
    // This runs on every worker tick; a rename repair that writes unconditionally
    // is a write per tick forever.
    expect(update).not.toHaveBeenCalled();
  });

  it('still returns the account when the handle cannot be restored', async () => {
    const { admin } = adminWith({
      profile: { id: 'cat-1', username: 'user_0234d5e38e66' },
      updateError: { message: 'duplicate key value violates unique constraint' },
    });

    // Somebody else holding `cat` is bad, but refusing to return the account
    // would turn a wrong name into total silence — strictly worse.
    await expect(ensureCatAccount(admin)).resolves.toEqual({
      id: 'cat-1',
      username: 'user_0234d5e38e66',
    });
  });
});
