import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  circleForCaller,
  createIdentity,
  deleteIdentity,
  getCircle,
  heldIdentityIds,
  otherCircleMemberIds,
  waitingByMember,
  type Caller,
} from '@/domain/identities/service';
import { mintSwitchCode, switchSessionTo } from '@/domain/identities/switching';
import { MAX_IDENTITIES, isUnreachableEmail } from '@/config/identities';

const unread = vi.hoisted(() => vi.fn());
vi.mock('@/services/notifications/unread-count', () => ({ countUnreadNotifications: unread }));

/**
 * The circle is the whole authority model (ADR-0014): a session for one member
 * may become a session for any other member and for nobody else. These tests
 * pin that boundary, and that a half-made identity never survives a failure.
 */

interface World {
  links: Array<{
    identity_user_id: string;
    holder_user_id: string;
    created_at: string;
    lost_circle_at?: string | null;
  }>;
  profiles: Array<{
    id: string;
    username: string | null;
    name: string | null;
    avatar_url: null;
    email?: string | null;
  }>;
  users: Record<string, { email: string | null; is_anonymous?: boolean }>;
  failOn?: 'profile' | 'link';
  linkErrorCode?: string;
  /** Reading identity_links fails, as on a dropped connection. */
  linkReadFails?: boolean;
}

/** A LIKE pattern as PostgreSQL reads it: % and _ are wildcards, \\ escapes. */
function likeToRegExp(pattern: string): RegExp {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === '\\' && i + 1 < pattern.length) {
      out += pattern[++i]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    } else if (c === '%') {
      out += '.*';
    } else if (c === '_') {
      out += '.';
    } else {
      out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${out}$`, 'i');
}

function fakeAdmin(world: World) {
  const deleted: string[] = [];
  let seq = 0;

  function table(name: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let mode: 'select' | 'update' | 'delete' = 'select';
    const sorts: string[] = [];
    let patch: Record<string, unknown> = {};
    const rows = () =>
      (name === 'identity_links' ? world.links : world.profiles) as unknown as Array<
        Record<string, unknown>
      >;
    const run = () => {
      if (name === 'identity_links' && world.linkReadFails && mode === 'select') {
        return { data: null, error: { code: '08006', message: 'connection lost' } };
      }
      if (mode === 'delete') {
        const gone = rows().filter(r => filters.every(f => f(r)));
        world.links = world.links.filter(
          l => !gone.includes(l as unknown as Record<string, unknown>)
        );
        return { data: gone, error: null };
      }
      if (mode === 'update') {
        if (world.failOn === 'profile') {
          return { data: null, error: { code: 'XX000', message: 'boom' } };
        }
        rows()
          .filter(r => filters.every(f => f(r)))
          .forEach(r => Object.assign(r, patch));
        return { data: null, error: null };
      }
      const found = rows().filter(r => filters.every(f => f(r)));
      for (const col of [...sorts].reverse()) {
        found.sort((a, b) => String(a[col] ?? '').localeCompare(String(b[col] ?? '')));
      }
      return { data: found, error: null };
    };
    const chain = {
      select: () => chain,
      eq: (col: string, value: unknown) => (filters.push(r => r[col] === value), chain),
      in: (col: string, values: unknown[]) => (filters.push(r => values.includes(r[col])), chain),
      ilike: (col: string, value: string) => (
        filters.push(r => likeToRegExp(value).test(String(r[col] ?? ''))),
        chain
      ),
      order: (col: string) => (sorts.push(col), chain),
      delete: () => ((mode = 'delete'), chain),
      limit: () => chain,
      maybeSingle: async () => {
        const r = run();
        return { data: r.data?.[0] ?? null, error: r.error };
      },
      update: (p: Record<string, unknown>) => ((mode = 'update'), (patch = p), chain),
      insert: async (row: Record<string, string>) => {
        if (world.failOn === 'link') {
          return { error: { code: world.linkErrorCode ?? 'XX000', message: 'boom' } };
        }
        world.links.push({ ...row, created_at: `t${seq++}` } as World['links'][number]);
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return chain;
  }

  const admin = {
    from: table,
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) =>
          world.users[id]
            ? { data: { user: { id, ...world.users[id] } }, error: null }
            : { data: { user: null }, error: { message: 'not found' } }
        ),
        createUser: vi.fn(async ({ email }: { email: string }) => {
          const id = `new-${seq++}`;
          world.users[id] = { email };
          world.profiles.push({ id, username: `user_${id}`, name: null, avatar_url: null, email });
          return { data: { user: { id } }, error: null };
        }),
        deleteUser: vi.fn(async (id: string) => {
          deleted.push(id);
          delete world.users[id];
          world.profiles = world.profiles.filter(p => p.id !== id);
          world.links = world.links.filter(l => l.identity_user_id !== id);
          return { error: null };
        }),
        generateLink: vi.fn(async ({ email }: { email: string }) => ({
          data: { properties: { email_otp: `otp-for-${email}` } },
          error: null,
        })),
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, raw: admin, deleted };
}

/** A caller in the session that member would really have: a switch for an identity. */
function as(userId: string, sessionMethods?: string[]): Caller {
  return {
    userId,
    sessionMethods: sessionMethods ?? (userId === 'alberto' ? ['otp'] : ['password']),
  };
}

function world(): World {
  return {
    links: [{ identity_user_id: 'alberto', holder_user_id: 'fernando', created_at: 't' }],
    profiles: [
      { id: 'fernando', username: 'fernando', name: 'Fernando', avatar_url: null },
      { id: 'alberto', username: 'caeiro', name: 'Alberto Caeiro', avatar_url: null },
      { id: 'stranger', username: 'stranger', name: 'Stranger', avatar_url: null },
    ],
    users: {
      fernando: { email: 'fernando@example.com' },
      alberto: { email: 'identity-aa@orangecat.invalid' },
      stranger: { email: 'stranger@example.com' },
    },
  };
}

describe('the circle is derived from the signed-in account, never claimed', () => {
  it('is the same circle whether the holder or an identity asks', async () => {
    const { admin } = fakeAdmin(world());
    const asHolder = await getCircle(admin, 'fernando');
    const asIdentity = await getCircle(admin, 'alberto');
    expect(asHolder.holderId).toBe('fernando');
    expect(asIdentity.holderId).toBe('fernando');
    expect(asIdentity.members.map(m => m.id)).toEqual(['fernando', 'alberto']);
    expect(asIdentity.members.map(m => m.isHolder)).toEqual([true, false]);
  });

  it('is a circle of one for a person with no identities', async () => {
    const { admin } = fakeAdmin(world());
    const circle = await getCircle(admin, 'stranger');
    expect(circle.members.map(m => m.id)).toEqual(['stranger']);
  });
});

describe('switching reaches every member of the circle and nobody else', () => {
  it('mints a code for the holder when an identity asks, and the reverse', async () => {
    const { admin } = fakeAdmin(world());
    const back = await mintSwitchCode(admin, as('alberto'), 'fernando');
    expect(back).toEqual({
      ok: true,
      data: { email: 'fernando@example.com', code: 'otp-for-fernando@example.com' },
    });
    const out = await mintSwitchCode(admin, as('fernando'), 'alberto');
    expect(out.ok).toBe(true);
  });

  it('refuses an account outside the circle WITHOUT generating a code for it', async () => {
    const { admin, raw } = fakeAdmin(world());
    expect(await mintSwitchCode(admin, as('fernando'), 'stranger')).toMatchObject({
      ok: false,
      reason: 'not_in_circle',
    });
    expect(await mintSwitchCode(admin, as('stranger'), 'alberto')).toMatchObject({
      ok: false,
      reason: 'not_in_circle',
    });
    expect(await mintSwitchCode(admin, as('stranger'), 'fernando')).toMatchObject({
      ok: false,
      reason: 'not_in_circle',
    });
    expect(raw.auth.admin.generateLink).not.toHaveBeenCalled();
  });
});

describe('creating an identity', () => {
  it('creates an account on an unreachable address, held by the HOLDER even when an identity asks', async () => {
    const w = world();
    const { admin, raw } = fakeAdmin(w);
    const result = await createIdentity(admin, as('alberto'), {
      name: 'Ricardo Reis',
      username: 'reis',
    });
    expect(result.ok).toBe(true);
    const email = raw.auth.admin.createUser.mock.calls[0]![0].email as string;
    expect(isUnreachableEmail(email)).toBe(true);
    expect(email).not.toContain('reis');
    const link = w.links.at(-1)!;
    expect(link.holder_user_id).toBe('fernando');
    const profile = w.profiles.find(p => p.id === link.identity_user_id)!;
    expect(profile).toMatchObject({ username: 'reis', name: 'Ricardo Reis', email: null });
  });

  it('refuses a holder nobody could get back into', async () => {
    for (const user of [
      { email: null },
      { email: 'a@b.c', is_anonymous: true },
      { email: 'x@orangecat.invalid' },
    ]) {
      const w = world();
      w.users.fernando = user;
      const { admin, raw } = fakeAdmin(w);
      expect(
        await createIdentity(admin, as('fernando'), { name: 'N', username: 'newname' })
      ).toMatchObject({
        ok: false,
        reason: 'holder_needs_email',
      });
      expect(raw.auth.admin.createUser).not.toHaveBeenCalled();
    }
  });

  it('refuses a taken handle (any case), a reserved one, and an empty name', async () => {
    const { admin, raw } = fakeAdmin(world());
    expect(
      await createIdentity(admin, as('fernando'), { name: 'N', username: 'CAEIRO' })
    ).toMatchObject({ reason: 'username_taken' });
    expect(
      await createIdentity(admin, as('fernando'), { name: 'N', username: 'cat' })
    ).toMatchObject({
      reason: 'invalid_username',
    });
    expect(
      await createIdentity(admin, as('fernando'), { name: '  ', username: 'fine_name' })
    ).toMatchObject({ reason: 'invalid_name' });
    expect(raw.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('stops at the product limit', async () => {
    const w = world();
    for (let i = 1; i < MAX_IDENTITIES; i++) {
      w.links.push({ identity_user_id: `i${i}`, holder_user_id: 'fernando', created_at: `t${i}` });
    }
    const { admin } = fakeAdmin(w);
    expect(
      await createIdentity(admin, as('fernando'), { name: 'N', username: 'onemore' })
    ).toMatchObject({ reason: 'limit_reached' });
  });

  it('removes the account again when the profile or the link cannot be written', async () => {
    for (const failOn of ['profile', 'link'] as const) {
      const w = { ...world(), failOn };
      const { admin, deleted } = fakeAdmin(w);
      const result = await createIdentity(admin, as('fernando'), {
        name: 'N',
        username: 'halfmade',
      });
      expect(result.ok).toBe(false);
      expect(deleted).toHaveLength(1);
      expect(w.links).toHaveLength(1);
    }
  });
});

describe('deleting an identity', () => {
  it('deletes one the caller holds, after its connected apps are revoked', async () => {
    const { admin, deleted } = fakeAdmin(world());
    const before = vi.fn(async () => undefined);
    expect(await deleteIdentity(admin, as('fernando'), 'alberto', before)).toMatchObject({
      ok: true,
    });
    expect(before).toHaveBeenCalledWith('alberto');
    expect(deleted).toEqual(['alberto']);
  });

  it('never deletes the holder, the signed-in identity, or anyone outside the circle', async () => {
    const { admin, deleted } = fakeAdmin(world());
    const before = vi.fn(async () => undefined);
    expect(await deleteIdentity(admin, as('alberto'), 'fernando', before)).toMatchObject({
      reason: 'is_holder',
    });
    expect(await deleteIdentity(admin, as('alberto'), 'alberto', before)).toMatchObject({
      reason: 'is_current',
    });
    expect(await deleteIdentity(admin, as('fernando'), 'stranger', before)).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(await deleteIdentity(admin, as('stranger'), 'alberto', before)).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(before).not.toHaveBeenCalled();
    expect(deleted).toEqual([]);
  });
});

describe('what ends together', () => {
  it('sign-out everywhere reaches the rest of the circle from any member', async () => {
    const { admin } = fakeAdmin(world());
    expect(await otherCircleMemberIds(admin, as('fernando'))).toEqual(['alberto']);
    expect(await otherCircleMemberIds(admin, as('alberto'))).toEqual(['fernando']);
    expect(await otherCircleMemberIds(admin, as('stranger'))).toEqual([]);
  });

  it('deleting the holder takes its identities; deleting an identity takes nothing else', async () => {
    const { admin } = fakeAdmin(world());
    expect(await heldIdentityIds(admin, 'fernando')).toEqual(['alberto']);
    expect(await heldIdentityIds(admin, 'alberto')).toEqual([]);
  });
});

describe('an identity with a way in of its own loses the circle', () => {
  // The escalation this closes: an identity is given a password (or a real
  // address) in its own settings and its login is handed to someone else. That
  // person must not be one request away from the holder's main account.
  const cases: Array<[string, string[], string | null]> = [
    ['a password session', ['password'], null],
    ['an OAuth session', ['oauth'], null],
    ['a session of unknown origin', [], null],
    ['a password session that was later refreshed', ['password', 'token_refresh'], null],
    ['a switch session, once the identity has a real address', ['otp'], 'caeiro@example.com'],
  ];

  for (const [label, methods, newEmail] of cases) {
    it(`withholds it from ${label}`, async () => {
      const w = world();
      if (newEmail) {
        w.users.alberto = { email: newEmail };
      }
      const { admin, raw, deleted } = fakeAdmin(w);
      const caller = as('alberto', methods);

      const circle = await circleForCaller(admin, caller);
      expect(circle.withheld).toBe(true);
      expect(circle.members.map(m => m.id)).toEqual(['alberto']);

      expect(await mintSwitchCode(admin, caller, 'fernando')).toMatchObject({
        reason: 'not_in_circle',
      });
      expect(await createIdentity(admin, caller, { name: 'N', username: 'another' })).toMatchObject(
        {
          reason: 'not_in_circle',
        }
      );
      expect(await deleteIdentity(admin, caller, 'fernando', async () => undefined)).toMatchObject({
        ok: false,
      });
      expect(await otherCircleMemberIds(admin, caller)).toEqual([]);
      expect(raw.auth.admin.generateLink).not.toHaveBeenCalled();
      expect(raw.auth.admin.createUser).not.toHaveBeenCalled();
      expect(deleted).toEqual([]);
    });
  }

  it('keeps it for a switch session, also after a refresh or a second factor', async () => {
    for (const methods of [
      ['otp'],
      ['otp', 'token_refresh'],
      ['magiclink', 'totp'],
      ['recovery'],
    ]) {
      const { admin } = fakeAdmin(world());
      const circle = await circleForCaller(admin, as('alberto', methods));
      expect(circle.withheld).toBeUndefined();
      expect(circle.members.map(m => m.id)).toEqual(['fernando', 'alberto']);
    }
  });

  it('never withholds a holder from its own circle, however it signed in', async () => {
    for (const methods of [['password'], ['oauth'], ['otp'], []]) {
      const { admin } = fakeAdmin(world());
      const circle = await circleForCaller(admin, as('fernando', methods));
      expect(circle.withheld).toBeUndefined();
      expect(circle.members).toHaveLength(2);
    }
  });
});

describe('switchSessionTo is the one place a session changes hands', () => {
  function session(error: { code?: string } | null = null) {
    return { auth: { verifyOtp: vi.fn(async () => ({ error })) } };
  }

  it('exchanges the code for the target on the caller’s own client', async () => {
    const { admin } = fakeAdmin(world());
    const s = session();
    expect(await switchSessionTo(admin, s, as('fernando'), 'alberto')).toEqual({
      ok: true,
      data: { id: 'alberto' },
    });
    expect(s.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'identity-aa@orangecat.invalid',
      token: 'otp-for-identity-aa@orangecat.invalid',
      type: 'email',
    });
  });

  it('never touches the session for a target outside the circle', async () => {
    const { admin } = fakeAdmin(world());
    const s = session();
    expect(await switchSessionTo(admin, s, as('fernando'), 'stranger')).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(s.auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('reports a refused exchange as a failure, not a switch', async () => {
    const { admin } = fakeAdmin(world());
    expect(
      await switchSessionTo(admin, session({ code: 'otp_expired' }), as('fernando'), 'alberto')
    ).toMatchObject({ ok: false, reason: 'failed' });
  });
});

describe('what waits in the other identities', () => {
  it('is counted for every member but the one in use', async () => {
    unread.mockReset();
    unread.mockImplementation(async (_c: unknown, id: string) => (id === 'fernando' ? 4 : 9));
    const { admin } = fakeAdmin(world());
    expect(await waitingByMember(admin, as('alberto'))).toEqual({ fernando: 4 });
    expect(await waitingByMember(admin, as('fernando'))).toEqual({ alberto: 9 });
  });

  it('is never answered outside the circle', async () => {
    unread.mockReset();
    unread.mockResolvedValue(7);
    const { admin } = fakeAdmin(world());
    expect(await waitingByMember(admin, as('stranger'))).toEqual({});
    // An identity entered with its own password has no circle, so no counts.
    expect(await waitingByMember(admin, as('alberto', ['password']))).toEqual({});
    expect(unread).not.toHaveBeenCalled();
  });

  it('leaves out a count it could not read, rather than saying zero', async () => {
    unread.mockReset();
    unread.mockRejectedValue(new Error('boom'));
    const { admin } = fakeAdmin(world());
    expect(await waitingByMember(admin, as('fernando'))).toEqual({});
  });
});

describe('review fixes: the circle holds its boundary', () => {
  it('never mints a code for switching to yourself, for anyone', async () => {
    const { admin, raw } = fakeAdmin(world());
    for (const caller of [
      as('fernando'),
      as('alberto'),
      as('alberto', ['password']),
      as('stranger'),
    ]) {
      expect(await mintSwitchCode(admin, caller, caller.userId)).toMatchObject({
        reason: 'not_in_circle',
      });
    }
    expect(raw.auth.admin.generateLink).not.toHaveBeenCalled();
  });

  it('cannot launder a password session into a switch session by "switching" to itself', async () => {
    // The attack the review found: an identity entered with its own password
    // switches to itself through any switch path, gets a one-time-code
    // session, and the gate then hands it the whole circle.
    const { admin } = fakeAdmin(world());
    const verifyOtp = vi.fn(async () => ({ error: null }));
    const result = await switchSessionTo(
      admin,
      { auth: { verifyOtp } },
      as('alberto', ['password']),
      'alberto'
    );
    expect(result).toMatchObject({ ok: false, reason: 'not_in_circle' });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('keeps an identity that has had a way in of its own alone for good, whatever its session says', async () => {
    const w = world();
    w.links[0]!.lost_circle_at = '2026-11-12T00:00:00Z';
    const { admin, raw } = fakeAdmin(w);
    const circle = await circleForCaller(admin, as('alberto', ['otp']));
    expect(circle.withheld).toBe(true);
    expect(circle.members.map(m => m.id)).toEqual(['alberto']);
    expect(await mintSwitchCode(admin, as('alberto', ['otp']), 'fernando')).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(raw.auth.admin.generateLink).not.toHaveBeenCalled();
    // The holder still has its circle, and can still reach the identity.
    expect((await circleForCaller(admin, as('fernando'))).members).toHaveLength(2);
  });

  it('throws rather than reading a failed lookup as "no identities"', async () => {
    const { admin } = fakeAdmin({ ...world(), linkReadFails: true });
    await expect(getCircle(admin, 'fernando')).rejects.toThrow(/Could not read/);
    await expect(heldIdentityIds(admin, 'fernando')).rejects.toThrow();
    await expect(otherCircleMemberIds(admin, as('fernando'))).rejects.toThrow();
  });

  it('treats _ in a handle literally when checking whether it is taken', async () => {
    const w = world();
    w.profiles.push({ id: 'x', username: 'axb', name: 'X', avatar_url: null });
    const { admin } = fakeAdmin(w);
    expect((await createIdentity(admin, as('fernando'), { name: 'N', username: 'a_b' })).ok).toBe(
      true
    );
    // ...and still finds a real clash, in any case.
    expect(
      await createIdentity(admin, as('fernando'), { name: 'N', username: 'A_B' })
    ).toMatchObject({ reason: 'username_taken' });
  });

  it('holds the product limit when creates race', async () => {
    const w = world();
    for (let i = 1; i < MAX_IDENTITIES - 1; i++) {
      w.links.push({ identity_user_id: `i${i}`, holder_user_id: 'fernando', created_at: `s${i}` });
    }
    const { admin } = fakeAdmin(w);
    // One slot left; three creates pass the check together.
    const results = await Promise.all(
      ['race_a', 'race_b', 'race_c'].map(username =>
        createIdentity(admin, as('fernando'), { name: 'N', username })
      )
    );
    expect(w.links.filter(l => l.holder_user_id === 'fernando')).toHaveLength(MAX_IDENTITIES);
    expect(results.filter(r => r.ok)).toHaveLength(1);
    expect(results.filter(r => !r.ok).every(r => !r.ok && r.reason === 'limit_reached')).toBe(true);
  });
});
