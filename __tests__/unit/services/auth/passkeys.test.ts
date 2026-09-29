import { vi } from 'vitest';

/**
 * Passkey wrappers: the shape the settings card and the sign-in button rely
 * on, and the one non-obvious rule — a passkey is named in a second call, and
 * a failed rename still returns a working passkey.
 */
vi.mock('@/utils/logger', () => ({
  logger: { auth: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { list, update, del, registerPasskey, signInWithPasskeyMock } = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  registerPasskey: vi.fn(),
  signInWithPasskeyMock: vi.fn(),
}));

vi.mock('@/lib/supabase/browser', () => ({
  default: {
    auth: {
      passkey: { list, update, delete: del },
      registerPasskey,
      signInWithPasskey: signInWithPasskeyMock,
    },
  },
}));

import {
  addPasskey,
  listPasskeys,
  removePasskey,
  signInWithPasskey,
} from '@/services/supabase/auth/passkeys';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('listPasskeys', () => {
  it('maps the server rows to the card shape', async () => {
    list.mockResolvedValue({
      data: [
        { id: 'p1', friendly_name: 'Mac', created_at: '2026-09-01', last_used_at: '2026-09-28' },
        { id: 'p2', created_at: '2026-09-02' },
      ],
      error: null,
    });
    expect(await listPasskeys()).toEqual({
      passkeys: [
        { id: 'p1', friendlyName: 'Mac', createdAt: '2026-09-01', lastUsedAt: '2026-09-28' },
        { id: 'p2', friendlyName: null, createdAt: '2026-09-02', lastUsedAt: null },
      ],
      error: null,
    });
  });

  it('returns an empty list with the error when the server refuses', async () => {
    list.mockResolvedValue({ data: null, error: new Error('passkeys disabled') });
    const r = await listPasskeys();
    expect(r.passkeys).toEqual([]);
    expect(r.error?.message).toBe('passkeys disabled');
  });
});

describe('addPasskey', () => {
  it('registers, then names the passkey', async () => {
    registerPasskey.mockResolvedValue({
      data: { id: 'p9', created_at: '2026-09-29' },
      error: null,
    });
    update.mockResolvedValue({
      data: { id: 'p9', friendly_name: 'Phone', created_at: '2026-09-29' },
      error: null,
    });
    const r = await addPasskey('  Phone ');
    expect(update).toHaveBeenCalledWith({ passkeyId: 'p9', friendlyName: 'Phone' });
    expect(r).toEqual({
      passkey: { id: 'p9', friendlyName: 'Phone', createdAt: '2026-09-29', lastUsedAt: null },
      error: null,
    });
  });

  it('still returns the passkey when naming it fails', async () => {
    registerPasskey.mockResolvedValue({
      data: { id: 'p9', created_at: '2026-09-29' },
      error: null,
    });
    update.mockResolvedValue({ data: null, error: new Error('rename failed') });
    const r = await addPasskey('Phone');
    expect(r.error).toBeNull();
    expect(r.passkey).toMatchObject({ id: 'p9', friendlyName: null });
  });

  it('does not name a passkey when the name is blank', async () => {
    registerPasskey.mockResolvedValue({
      data: { id: 'p9', created_at: '2026-09-29' },
      error: null,
    });
    await addPasskey('   ');
    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces a cancelled ceremony as an error, not a passkey', async () => {
    registerPasskey.mockResolvedValue({
      data: null,
      error: new Error('The operation was aborted'),
    });
    const r = await addPasskey('x');
    expect(r.passkey).toBeNull();
    expect(r.error?.message).toMatch(/aborted/);
  });
});

describe('removePasskey / signInWithPasskey', () => {
  it('deletes by id', async () => {
    del.mockResolvedValue({ data: null, error: null });
    expect(await removePasskey('p1')).toEqual({ error: null });
    expect(del).toHaveBeenCalledWith({ passkeyId: 'p1' });
  });

  it('counts a sign-in as success only with a session', async () => {
    signInWithPasskeyMock.mockResolvedValue({ data: { session: null, user: null }, error: null });
    expect((await signInWithPasskey()).success).toBe(false);
    signInWithPasskeyMock.mockResolvedValue({
      data: { session: { access_token: 't' }, user: { id: 'u1' } },
      error: null,
    });
    expect(await signInWithPasskey()).toEqual({ success: true, error: null });
  });
});
