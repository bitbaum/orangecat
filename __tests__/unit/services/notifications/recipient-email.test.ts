import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const client = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: () => client.value }));

import { resolveRecipientEmail } from '@/services/notifications/recipientEmail';

/**
 * One rule for where a person's mail goes. The case that made it necessary:
 * an identity (ADR-0014) sits on an undeliverable `.invalid` address, and
 * every notification path mailed it there, so a payment on an identity never
 * reached the person.
 */

interface World {
  profiles: Record<
    string,
    { name?: string | null; username?: string | null; contact_email?: string | null }
  >;
  users: Record<string, string | null>;
  links: Record<string, string>;
}

function admin(w: World) {
  return {
    from: (table: string) => {
      let id = '';
      const chain = {
        select: () => chain,
        eq: (_col: string, v: string) => ((id = v), chain),
        maybeSingle: async () => {
          if (table === 'identity_links') {
            return { data: w.links[id] ? { holder_user_id: w.links[id] } : null, error: null };
          }
          return { data: w.profiles[id] ?? null, error: null };
        },
      };
      return chain;
    },
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: w.users[id] ?? null } },
          error: null,
        })),
      },
    },
  } as unknown as SupabaseClient;
}

/** Resolve `userId` in this world: the module reads its own admin client. */
function resolveIn(w: World, userId: string) {
  client.value = admin(w);
  return resolveRecipientEmail(userId);
}

const base = (): World => ({
  profiles: {
    holder: { name: 'Fernando', contact_email: null },
    alberto: { name: 'Alberto Caeiro', username: 'caeiro', contact_email: null },
    plain: { username: 'plain', contact_email: 'shop@example.com' },
    cat: { username: 'cat' },
  },
  users: {
    holder: 'f@example.com',
    alberto: 'identity-aa@orangecat.invalid',
    plain: 'p@example.com',
    cat: 'cat@orangecat.invalid',
  },
  links: { alberto: 'holder' },
});

describe('resolveRecipientEmail', () => {
  it('prefers the contact address the person chose, then their account address', async () => {
    const w = base();
    expect(await resolveIn(w, 'plain')).toEqual({
      email: 'shop@example.com',
      displayName: 'plain',
    });
    w.profiles.plain!.contact_email = null;
    expect((await resolveIn(w, 'plain'))?.email).toBe('p@example.com');
  });

  it("sends an identity's mail to the account that holds it, greeting the identity", async () => {
    expect(await resolveIn(base(), 'alberto')).toEqual({
      email: 'f@example.com',
      displayName: 'Alberto Caeiro',
    });
  });

  it("uses an identity's own contact address when it has one", async () => {
    const w = base();
    w.profiles.alberto!.contact_email = 'caeiro@example.com';
    expect((await resolveIn(w, 'alberto'))?.email).toBe('caeiro@example.com');
  });

  it('never returns an undeliverable address, and has none for an account nobody holds', async () => {
    // The Cat: on .invalid and not anyone's identity.
    expect(await resolveIn(base(), 'cat')).toBeNull();
    const w = base();
    w.profiles.plain!.contact_email = 'x@orangecat.invalid';
    w.users.plain = 'y@orangecat.invalid';
    expect(await resolveIn(w, 'plain')).toBeNull();
  });

  it('has nothing to send to when the holder has no address either', async () => {
    const w = base();
    w.users.holder = null;
    expect(await resolveIn(w, 'alberto')).toBeNull();
  });
});
