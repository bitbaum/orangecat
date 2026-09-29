import { vi } from 'vitest';

/**
 * Connected apps: the list joins remembered consents, live refresh tokens and
 * the client registry; revoking removes the consent AND revokes the tokens,
 * always scoped to the one user. The admin client bypasses RLS, so the
 * user filter in every query is the only tenancy boundary — pinned here.
 */
vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

interface Call {
  table: string;
  op: 'select' | 'delete' | 'update';
  filters: Array<[string, unknown]>;
  patch?: unknown;
}
const calls: Call[] = [];
let grants: unknown[] = [];
let tokens: unknown[] = [];
let clients: unknown[] = [];
let deleted: unknown[] = [];
let revokedRows: unknown[] = [];

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: (table: string) => {
      const call: Call = { table, op: 'select', filters: [] };
      calls.push(call);
      const result = () => {
        if (call.op === 'delete') return { data: deleted, error: null };
        if (call.op === 'update') return { data: revokedRows, error: null };
        if (table === 'oauth_user_grants') return { data: grants, error: null };
        if (table === 'oauth_refresh_tokens') return { data: tokens, error: null };
        if (table === 'oauth_clients') return { data: clients, error: null };
        return { data: [], error: null };
      };
      const chain: Record<string, unknown> = {
        select: () => chain,
        order: () => chain,
        in: (col: string, v: unknown) => (call.filters.push([col, v]), chain),
        eq: (col: string, v: unknown) => (call.filters.push([col, v]), chain),
        is: (col: string, v: unknown) => (call.filters.push([col, v]), chain),
        delete: () => ((call.op = 'delete'), chain),
        update: (patch: unknown) => ((call.op = 'update'), (call.patch = patch), chain),
        then: (resolve: (v: unknown) => void) => resolve(result()),
      };
      return chain;
    },
  })),
}));

import {
  listConnectedApps,
  revokeAllConnectedApps,
  revokeConnectedApp,
} from '@/services/auth/connectedApps';

const USER = 'user-1';
const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 1000).toISOString();

beforeEach(() => {
  calls.length = 0;
  grants = [];
  tokens = [];
  clients = [];
  deleted = [];
  revokedRows = [];
});

describe('listConnectedApps', () => {
  it('joins consent, live sessions and the client registry into one row per app', async () => {
    grants = [{ client_id: 'loki', scopes: ['openid', 'profile'], granted_at: '2026-09-01' }];
    tokens = [
      { client_id: 'loki', last_used_at: '2026-09-20T10:00:00Z', expires_at: future },
      { client_id: 'loki', last_used_at: '2026-09-28T10:00:00Z', expires_at: future },
      // expired: not a live session, and its last use does not count
      { client_id: 'loki', last_used_at: '2026-09-29T10:00:00Z', expires_at: past },
    ];
    clients = [{ client_id: 'loki', name: 'Loki', registered_via: 'admin', is_trusted: true }];

    const apps = await listConnectedApps(USER);
    expect(apps).toEqual([
      {
        clientId: 'loki',
        name: 'Loki',
        registeredVia: 'admin',
        trusted: true,
        scopes: ['openid', 'profile'],
        grantedAt: '2026-09-01',
        lastUsedAt: '2026-09-28T10:00:00Z',
        liveSessions: 2,
      },
    ]);
  });

  it('shows an app that holds a live session even without a remembered consent', async () => {
    tokens = [{ client_id: 'dcr_abc', last_used_at: null, expires_at: future }];
    clients = [
      { client_id: 'dcr_abc', name: 'Some AI app', registered_via: 'dcr', is_trusted: false },
    ];
    const apps = await listConnectedApps(USER);
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ name: 'Some AI app', registeredVia: 'dcr', liveSessions: 1 });
  });

  it('returns nothing, and queries no clients, when nothing is connected', async () => {
    expect(await listConnectedApps(USER)).toEqual([]);
    expect(calls.map(c => c.table)).not.toContain('oauth_clients');
  });

  it('scopes every query to the user', async () => {
    grants = [{ client_id: 'loki', scopes: [], granted_at: '2026-09-01' }];
    clients = [{ client_id: 'loki', name: 'Loki', registered_via: 'admin', is_trusted: true }];
    await listConnectedApps(USER);
    for (const c of calls.filter(c => c.table !== 'oauth_clients')) {
      expect(c.filters).toContainEqual(['user_id', USER]);
    }
  });
});

describe('revokeConnectedApp', () => {
  it('deletes the consent and revokes only this user’s unrevoked tokens for the client', async () => {
    deleted = [{ client_id: 'loki' }];
    revokedRows = [{ id: 't1' }, { id: 't2' }];
    const result = await revokeConnectedApp(USER, 'loki');
    expect(result).toEqual({ revoked: true, tokensRevoked: 2 });

    const del = calls.find(c => c.op === 'delete');
    const upd = calls.find(c => c.op === 'update');
    expect(del?.table).toBe('oauth_user_grants');
    expect(del?.filters).toEqual(
      expect.arrayContaining([
        ['user_id', USER],
        ['client_id', 'loki'],
      ])
    );
    expect(upd?.table).toBe('oauth_refresh_tokens');
    expect(upd?.filters).toEqual(
      expect.arrayContaining([
        ['user_id', USER],
        ['client_id', 'loki'],
        ['revoked_at', null],
      ])
    );
    expect(upd?.patch).toMatchObject({ revoked_at: expect.any(String) });
  });

  it('is a no-op, not an error, when nothing was connected', async () => {
    await expect(revokeConnectedApp(USER, 'nobody')).resolves.toEqual({
      revoked: false,
      tokensRevoked: 0,
    });
  });
});

describe('revokeAllConnectedApps', () => {
  it('revokes every unrevoked token for the user and keeps consents on sign-out', async () => {
    revokedRows = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];
    const result = await revokeAllConnectedApps(USER, { forgetConsents: false });
    expect(result).toEqual({ tokensRevoked: 3 });
    const upd = calls.find(c => c.op === 'update');
    expect(upd?.table).toBe('oauth_refresh_tokens');
    expect(upd?.filters).toEqual(
      expect.arrayContaining([
        ['user_id', USER],
        ['revoked_at', null],
      ])
    );
    // No client filter: every app. And no delete: consents survive a sign-out.
    expect(upd?.filters.map(f => f[0])).not.toContain('client_id');
    expect(calls.find(c => c.op === 'delete')).toBeUndefined();
  });

  it('also forgets every consent on account deletion', async () => {
    await revokeAllConnectedApps(USER, { forgetConsents: true });
    const del = calls.find(c => c.op === 'delete');
    expect(del?.table).toBe('oauth_user_grants');
    expect(del?.filters).toEqual([['user_id', USER]]);
  });
});
