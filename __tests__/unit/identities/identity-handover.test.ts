import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  acceptHandover,
  cancelHandover,
  hashHandoverToken,
  listHandovers,
  offerHandover,
  previewHandover,
} from '@/domain/identities/handover';
import type { Caller } from '@/domain/identities/service';

/**
 * Handing an identity over is an account changing hands, and it cannot be
 * undone. These pin who may offer, that the link is the only credential and is
 * never stored, and above all the order of acceptance: a failure must leave
 * the holder holding the identity, never an account that has a new owner and
 * is still one switch away from the old one.
 */

type Row = Record<string, unknown>;

function fakeAdmin(
  opts: { emailError?: { message: string; code?: string }; relinkFails?: boolean } = {}
) {
  const tables: Record<string, Row[]> = {
    identity_links: [{ identity_user_id: 'alberto', holder_user_id: 'fernando', created_at: 't' }],
    identity_handovers: [],
    profiles: [
      { id: 'fernando', name: 'Fernando', username: 'fernando', email: 'f@example.com' },
      { id: 'alberto', name: 'Alberto Caeiro', username: 'caeiro', email: null },
      { id: 'stranger', name: 'Stranger', username: 'stranger', email: 's@example.com' },
    ],
  };
  const users: Record<string, { email: string }> = {
    fernando: { email: 'f@example.com' },
    alberto: { email: 'identity-aa@orangecat.invalid' },
    stranger: { email: 's@example.com' },
  };
  const log: string[] = [];
  let linkInserts = 0;

  function from(name: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let mode: 'select' | 'delete' | 'update' = 'select';
    let patch: Row = {};
    const matching = () => tables[name]!.filter(r => filters.every(f => f(r)));
    const run = () => {
      if (mode === 'delete') {
        const gone = matching();
        tables[name] = tables[name]!.filter(r => !gone.includes(r));
        log.push(`delete ${name} x${gone.length}`);
        return { data: gone, error: null };
      }
      if (mode === 'update') {
        matching().forEach(r => Object.assign(r, patch));
        return { data: null, error: null };
      }
      return { data: matching(), error: null };
    };
    const chain = {
      select: () => chain,
      eq: (c: string, v: unknown) => (filters.push(r => r[c] === v), chain),
      in: (c: string, v: unknown[]) => (filters.push(r => v.includes(r[c])), chain),
      gt: (c: string, v: string) => (filters.push(r => String(r[c]) > v), chain),
      order: () => chain,
      maybeSingle: async () => ({ data: run().data?.[0] ?? null, error: null }),
      delete: () => ((mode = 'delete'), chain),
      update: (p: Row) => ((mode = 'update'), (patch = p), chain),
      insert: async (row: Row) => {
        if (name === 'identity_links' && opts.relinkFails && ++linkInserts > 0) {
          return { error: { code: 'XX000', message: 'boom' } };
        }
        tables[name]!.push({ ...row });
        log.push(`insert ${name}`);
        return { error: null };
      },
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    return chain;
  }

  const admin = {
    from,
    rpc: vi.fn(async (fn: string) => (log.push(`rpc ${fn}`), { data: 1, error: null })),
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, ...users[id] } },
          error: null,
        })),
        updateUserById: vi.fn(async (id: string, attrs: { email: string }) => {
          log.push('updateUser');
          if (opts.emailError) {
            return { error: opts.emailError };
          }
          users[id] = { email: attrs.email };
          return { error: null };
        }),
      },
    },
  };
  return { admin: admin as unknown as SupabaseClient, raw: admin, tables, users, log };
}

const holder: Caller = { userId: 'fernando', sessionMethods: ['password'] };
const identity: Caller = { userId: 'alberto', sessionMethods: ['otp'] };
const stranger: Caller = { userId: 'stranger', sessionMethods: ['password'] };

describe('offering an identity', () => {
  it('returns a token once and stores only its hash', async () => {
    const f = fakeAdmin();
    const result = await offerHandover(f.admin, holder, 'alberto');
    expect(result.ok).toBe(true);
    const token = result.ok ? result.data.token : '';
    expect(token.length).toBeGreaterThanOrEqual(43);
    const stored = f.tables.identity_handovers![0]!;
    expect(stored.token_hash).toBe(hashHandoverToken(token));
    expect(JSON.stringify(f.tables.identity_handovers)).not.toContain(token);
    expect(stored.offered_by).toBe('fernando');
  });

  it('offering again replaces the last link, which stops working', async () => {
    const f = fakeAdmin();
    const first = await offerHandover(f.admin, holder, 'alberto');
    const second = await offerHandover(f.admin, holder, 'alberto');
    expect(f.tables.identity_handovers).toHaveLength(1);
    expect(await previewHandover(f.admin, first.ok ? first.data.token : '')).toBeNull();
    expect(await previewHandover(f.admin, second.ok ? second.data.token : '')).not.toBeNull();
  });

  it('is refused for the main account, for a stranger, and for an identity that is not theirs', async () => {
    const f = fakeAdmin();
    expect(await offerHandover(f.admin, holder, 'fernando')).toMatchObject({ reason: 'is_holder' });
    expect(await offerHandover(f.admin, stranger, 'alberto')).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(await offerHandover(f.admin, holder, 'stranger')).toMatchObject({
      reason: 'not_in_circle',
    });
    expect(f.tables.identity_handovers).toHaveLength(0);
  });

  it('is refused for an identity entered with a way in of its own', async () => {
    const f = fakeAdmin();
    const withPassword: Caller = { userId: 'alberto', sessionMethods: ['password'] };
    expect(await offerHandover(f.admin, withPassword, 'alberto')).toMatchObject({
      reason: 'not_in_circle',
    });
  });

  it('can be offered from a switched session of another member, and listed and withdrawn', async () => {
    const f = fakeAdmin();
    f.tables.identity_links!.push({
      identity_user_id: 'ricardo',
      holder_user_id: 'fernando',
      created_at: 'u',
    });
    f.tables.profiles!.push({ id: 'ricardo', name: 'Ricardo Reis', username: 'reis', email: null });
    expect((await offerHandover(f.admin, identity, 'ricardo')).ok).toBe(true);
    expect((await listHandovers(f.admin, holder)).map(h => h.identityId)).toEqual(['ricardo']);
    expect(await listHandovers(f.admin, stranger)).toEqual([]);
    expect(await cancelHandover(f.admin, stranger, 'ricardo')).toMatchObject({
      reason: 'not_in_circle',
    });
    expect((await cancelHandover(f.admin, holder, 'ricardo')).ok).toBe(true);
    expect(await listHandovers(f.admin, holder)).toEqual([]);
  });
});

describe('the accept page reads, it does not spend', () => {
  it('names the identity and nothing about who offers it', async () => {
    const f = fakeAdmin();
    const offer = await offerHandover(f.admin, holder, 'alberto');
    const preview = await previewHandover(f.admin, offer.ok ? offer.data.token : '');
    expect(preview).toEqual({ name: 'Alberto Caeiro', username: 'caeiro' });
    expect(JSON.stringify(preview)).not.toContain('fernando');
    expect(f.tables.identity_handovers).toHaveLength(1);
  });

  it('answers an unknown, an empty and an expired link alike', async () => {
    const f = fakeAdmin();
    const offer = await offerHandover(f.admin, holder, 'alberto');
    f.tables.identity_handovers![0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await previewHandover(f.admin, offer.ok ? offer.data.token : '')).toBeNull();
    expect(await previewHandover(f.admin, 'not-a-token')).toBeNull();
    expect(await previewHandover(f.admin, '')).toBeNull();
  });
});

describe('accepting an offer', () => {
  async function offered(opts?: Parameters<typeof fakeAdmin>[0]) {
    const f = fakeAdmin(opts);
    const offer = await offerHandover(f.admin, holder, 'alberto');
    f.log.length = 0;
    return { f, token: offer.ok ? offer.data.token : '' };
  }

  it('cuts the link BEFORE giving the identity its address, then ends the old sessions', async () => {
    const { f, token } = await offered();
    const result = await acceptHandover(f.admin, token, '  New.Owner@Example.com ');
    expect(result).toEqual({ ok: true, identityId: 'alberto', email: 'new.owner@example.com' });
    expect(f.log.indexOf('delete identity_links x1')).toBeLessThan(f.log.indexOf('updateUser'));
    expect(f.log.indexOf('updateUser')).toBeLessThan(f.log.indexOf('rpc end_sessions_of'));
    expect(f.tables.identity_links).toHaveLength(0);
    expect(f.users.alberto!.email).toBe('new.owner@example.com');
    expect(f.raw.auth.admin.updateUserById).toHaveBeenCalledWith('alberto', {
      email: 'new.owner@example.com',
      email_confirm: true,
    });
  });

  it('refuses an address nobody can read or that is not one, before touching anything', async () => {
    const { f, token } = await offered();
    for (const email of ['x@orangecat.invalid', 'not-an-email', '', null]) {
      expect(await acceptHandover(f.admin, token, email)).toEqual({
        ok: false,
        reason: 'invalid_email',
      });
    }
    expect(f.log).toEqual([]);
    expect(f.tables.identity_links).toHaveLength(1);
  });

  it('refuses an unknown or expired link without touching anything', async () => {
    const { f, token } = await offered();
    expect(await acceptHandover(f.admin, 'wrong', 'a@b.co')).toEqual({ ok: false, reason: 'gone' });
    f.tables.identity_handovers![0]!.expires_at = new Date(Date.now() - 1000).toISOString();
    expect(await acceptHandover(f.admin, token, 'a@b.co')).toEqual({ ok: false, reason: 'gone' });
    expect(f.raw.auth.admin.updateUserById).not.toHaveBeenCalled();
    expect(f.tables.identity_links).toHaveLength(1);
  });

  it('puts the link and the offer back when the address is taken: the holder still holds it', async () => {
    const { f, token } = await offered({
      emailError: { message: 'A user with this email address has already been registered' },
    });
    expect(await acceptHandover(f.admin, token, 'taken@example.com')).toEqual({
      ok: false,
      reason: 'email_taken',
    });
    expect(f.tables.identity_links).toEqual([
      expect.objectContaining({ identity_user_id: 'alberto', holder_user_id: 'fernando' }),
    ]);
    expect(f.users.alberto!.email).toBe('identity-aa@orangecat.invalid');
    // The same link still works, so the person can try another address.
    expect(await previewHandover(f.admin, token)).not.toBeNull();
    expect(f.raw.rpc).not.toHaveBeenCalled();
  });

  it('works once: a second use of the same link finds nothing', async () => {
    const { f, token } = await offered();
    // The database trigger removes the offer when the link goes; the fake has
    // no triggers, so do what it does.
    await acceptHandover(f.admin, token, 'first@example.com');
    f.tables.identity_handovers = [];
    expect(await acceptHandover(f.admin, token, 'second@example.com')).toEqual({
      ok: false,
      reason: 'gone',
    });
    expect(f.users.alberto!.email).toBe('first@example.com');
  });
});
