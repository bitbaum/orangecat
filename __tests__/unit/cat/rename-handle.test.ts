/**
 * The Cat can change your @handle, and says what happens to the old one.
 *
 * Reported by a user 2026-08-29: asked to change their handle, the Cat replied
 * that "usernames cannot be changed once set" because "changing it would break
 * all existing links", and offered a display-name change instead. It was not
 * inventing that. Its brief said "Never update username (it breaks public
 * URLs)", and the handler excluded the field for the same stated reason.
 *
 * Both were true until profile_username_history (20260826160000) made a rename
 * safe, and neither was corrected afterwards. That is the failure worth pinning:
 * a rule outlived the constraint that justified it, and a stale instruction is a
 * second source of truth about what the product can do — one that does not get
 * updated when the database gains a capability.
 *
 * So what is asserted here is the whole user-visible contract, not just the
 * write: the rename happens, and the reply says the old handle still works.
 * That fact is the reason it is safe, and a rename announced without it reads
 * exactly like the breakage the user was wrongly warned about.
 */

import { contextHandlers } from '@/services/cat/handlers/context';
import { ProfileServerService } from '@/services/profile/server';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/services/profile/server', () => ({
  ProfileServerService: { checkUsernameAvailability: vi.fn() },
}));

const availabilityMock = ProfileServerService.checkUsernameAvailability as Mock;

const USER = 'cec88bc9-0000-0000-0000-000000000001';

/** Records the write the handler attempted, without a real Supabase. */
function makeSupabase(
  currentUsername: string | null,
  updateError: { code?: string; message: string } | null = null
) {
  const writes: Record<string, unknown>[] = [];
  const from = () => {
    let isUpdate = false;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self,
      eq: self,
      update: (values: Record<string, unknown>) => {
        isUpdate = true;
        writes.push(values);
        return chain;
      },
      single: () =>
        isUpdate
          ? Promise.resolve({ data: null, error: updateError })
          : Promise.resolve({ data: { username: currentUsername }, error: null }),
    });
    return chain;
  };
  return { supabase: { from } as never, writes };
}

const run = (supabase: never, params: Record<string, unknown>) =>
  contextHandlers.update_profile(supabase, USER, 'actor-1', params);

describe('update_profile — changing the @handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    availabilityMock.mockResolvedValue(true);
  });

  it('renames the account and tells them the old handle still works', async () => {
    const { supabase, writes } = makeSupabase('oldhandle');

    const result = await run(supabase, { username: 'catomean' });

    expect(result.success).toBe(true);
    expect(writes[0]).toMatchObject({ username: 'catomean' });
    // Both halves of the promise, named explicitly: the old profile URL and the
    // old Lightning address. Asserting only "success" would let the Cat land the
    // rename and still leave the user believing they had broken something.
    const message = String((result.data as { displayMessage: string }).displayMessage);
    expect(message).toContain('@catomean');
    expect(message).toContain('oldhandle@orangecat.ch');
    expect(message.toLowerCase()).toContain('redirect');
  });

  it('accepts a handle typed with the @ the user sees everywhere', async () => {
    const { supabase, writes } = makeSupabase('oldhandle');

    const result = await run(supabase, { username: '@catomean' });

    expect(result.success).toBe(true);
    expect(writes[0]).toMatchObject({ username: 'catomean' });
  });

  it('refuses a reserved handle through the same schema the signup form uses', async () => {
    const { supabase, writes } = makeSupabase('oldhandle');

    const result = await run(supabase, { username: 'cat' });

    expect(result.success).toBe(false);
    expect(writes).toHaveLength(0);
  });

  it('refuses a handle that is taken', async () => {
    availabilityMock.mockResolvedValue(false);
    const { supabase, writes } = makeSupabase('oldhandle');

    const result = await run(supabase, { username: 'catomean' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('taken');
    expect(writes).toHaveLength(0);
  });

  it('reports the database guard as "taken", not as a raw error', async () => {
    // profiles_username_rename_guard raises unique_violation for a handle
    // another account retired. It is the authority, not the availability check:
    // that check can go stale between reading and writing, the trigger cannot —
    // and the user should read the same sentence either way.
    const { supabase } = makeSupabase('oldhandle', { code: '23505', message: 'unique_violation' });

    const result = await run(supabase, { username: 'catomean' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('taken');
  });

  it('does not check availability against the handle they already have', async () => {
    // Saving an unchanged handle is not a rename. Treating it as one would tell
    // people their own handle is taken.
    const { supabase, writes } = makeSupabase('catomean');

    const result = await run(supabase, { username: 'catomean', bio: 'hello' });

    expect(result.success).toBe(true);
    expect(availabilityMock).not.toHaveBeenCalled();
    expect(writes[0]).not.toHaveProperty('username');
    expect(writes[0]).toMatchObject({ bio: 'hello' });
  });

  it('still updates ordinary fields without touching the handle', async () => {
    const { supabase, writes } = makeSupabase('oldhandle');

    const result = await run(supabase, { bio: 'freelance photographer' });

    expect(result.success).toBe(true);
    expect(writes[0]).not.toHaveProperty('username');
  });
});
