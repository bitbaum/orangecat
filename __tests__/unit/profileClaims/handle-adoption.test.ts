/**
 * ADR-0005 D7: the URL her friends were sent keeps working after she signs
 * up. Seen live 2026-09-10: a "Start instantly" account arrives with a minted
 * `user_<hex>` handle, which counted as "already has one", so the claimed
 * profile landed at /profiles/user_c445d449d3dc and the shared slug died.
 */

import { isMintedHandle } from '@/config/usernames';
import { wantsHandle } from '@/domain/profileClaims/fill';

describe('isMintedHandle', () => {
  it('recognises the platform-minted shape and nothing else', () => {
    expect(isMintedHandle('user_c445d449d3dc')).toBe(true);
    expect(isMintedHandle('USER_0234D5E38E66')).toBe(true);
    expect(isMintedHandle('annushka')).toBe(false);
    expect(isMintedHandle('user_annushka')).toBe(false);
    expect(isMintedHandle(null)).toBe(false);
  });
});

describe('wantsHandle', () => {
  it('adopts the slug over no handle or a minted one, never over a chosen one', () => {
    expect(wantsHandle(null, 'walkthrough-testperson')).toBe(true);
    expect(wantsHandle('user_c445d449d3dc', 'walkthrough-testperson')).toBe(true);
    expect(wantsHandle('annushka', 'walkthrough-testperson')).toBe(false);
    expect(wantsHandle(null, null)).toBe(false);
  });
});
