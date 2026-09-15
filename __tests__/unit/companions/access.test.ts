import { describe, it, expect } from 'vitest';
import { decideConversationAccess } from '@/services/companions/access';

/**
 * Who may start a conversation with a companion. The owner always can, in
 * any status — the old rule ("must be active") made every freshly created
 * assistant unusable by its own creator. Strangers need public AND active,
 * and a private companion's existence is not revealed to them.
 */
describe('decideConversationAccess', () => {
  const base = { user_id: 'owner' };

  it('lets the owner talk to a private, draft companion', () => {
    expect(
      decideConversationAccess({ ...base, status: 'draft', is_public: false }, 'owner')
    ).toEqual({ allowed: true, asOwner: true });
  });

  it('lets anyone talk to a public, active companion', () => {
    expect(
      decideConversationAccess({ ...base, status: 'active', is_public: true }, 'stranger')
    ).toEqual({ allowed: true, asOwner: false });
  });

  it('tells a stranger a private companion does not exist', () => {
    expect(
      decideConversationAccess({ ...base, status: 'active', is_public: false }, 'stranger')
    ).toEqual({ allowed: false, reason: 'not_found' });
  });

  it('refuses a stranger when a public companion is paused or archived', () => {
    for (const status of ['paused', 'archived', 'draft', null]) {
      expect(decideConversationAccess({ ...base, status, is_public: true }, 'stranger')).toEqual({
        allowed: false,
        reason: 'not_active',
      });
    }
  });
});
