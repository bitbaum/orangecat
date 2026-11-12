// @vitest-environment jsdom
/**
 * What OrangeCat hands to the packaged account menu.
 *
 * The menu's layout, keyboard handling and failure states are
 * @bitbaum/accountkit's and are tested there. This pins the part that is
 * OrangeCat's: who the person is, which identities they can switch to
 * (ADR-0014), and that a failed sign-out or switch reaches the menu as a
 * rejection, because that is how the menu knows to say so.
 */
import React from 'react';
import { render } from '@testing-library/react';
import type { AccountMenuProps } from '@bitbaum/accountkit';

const seen: { props: AccountMenuProps | null } = { props: null };

vi.mock('@bitbaum/accountkit/styles.css', () => ({}));
vi.mock('@bitbaum/accountkit', () => ({
  AccountMenu: (props: AccountMenuProps) => {
    seen.props = props;
    return <div data-testid="menu" />;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useThemeMode', () => ({
  useThemeMode: () => ({ mode: 'dark', cycle: vi.fn(), mounted: true }),
}));
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ fetchProfile: vi.fn() }) }));

const auth = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));

const others = vi.hoisted(() => ({ value: [] as unknown[] }));
vi.mock('@/hooks/useOtherIdentities', () => ({ useOtherIdentities: () => others.value }));

const switchTo = vi.hoisted(() => vi.fn());
vi.mock('@/lib/identities/client', () => ({ switchToIdentity: switchTo }));

import AccountMenuControl from '@/components/layout/AccountMenuControl';

function signedInAs(email: string, signOut = vi.fn(async () => ({ error: null }))) {
  auth.value = {
    user: { id: 'u1', email },
    session: null,
    profile: { name: 'Bernardo Soares', username: 'soares', avatar_url: null },
    signOut,
  };
  return signOut;
}

beforeEach(() => {
  seen.props = null;
  others.value = [];
  switchTo.mockReset();
});

describe('AccountMenuControl', () => {
  it('renders nothing when nobody is signed in', () => {
    auth.value = { user: null, session: null, profile: null, signOut: vi.fn() };
    const { container } = render(<AccountMenuControl />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the person from their profile and shows their own email', () => {
    signedInAs('bernardo@example.com');
    render(<AccountMenuControl />);
    expect(seen.props?.user).toEqual({
      name: 'Bernardo Soares',
      handle: 'soares',
      email: 'bernardo@example.com',
      image: null,
    });
  });

  it('shows no email for an identity, whose address nobody can read', () => {
    signedInAs('identity-ab12@orangecat.invalid');
    render(<AccountMenuControl />);
    expect(seen.props?.user.email).toBeNull();
  });

  it('offers the other identities, with the main account labelled', () => {
    signedInAs('identity-ab12@orangecat.invalid');
    others.value = [
      { id: 'h', name: 'George', username: 'cato', avatarUrl: null, isHolder: true },
      {
        id: 'r',
        name: 'Ricardo Reis',
        username: 'reis',
        avatarUrl: 'https://x/r.png',
        isHolder: false,
      },
    ];
    render(<AccountMenuControl />);
    expect(seen.props?.accounts).toEqual([
      { id: 'h', note: 'Main account', user: { name: 'George', handle: 'cato', image: null } },
      {
        id: 'r',
        note: undefined,
        user: { name: 'Ricardo Reis', handle: 'reis', image: 'https://x/r.png' },
      },
    ]);
  });

  it('turns a failed switch into a rejection, so the menu can say so', async () => {
    signedInAs('bernardo@example.com');
    switchTo.mockResolvedValue('Could not switch. Try again.');
    render(<AccountMenuControl />);
    await expect(seen.props?.onSwitchAccount?.('r')).rejects.toThrow('Could not switch');
    expect(switchTo).toHaveBeenCalledWith('r');
  });

  it('turns a failed sign-out into a rejection too', async () => {
    signedInAs(
      'bernardo@example.com',
      vi.fn(async () => ({ error: new Error('network') }))
    );
    render(<AccountMenuControl />);
    await expect(seen.props?.onSignOut()).rejects.toThrow('network');
  });

  it('keeps the theme reachable from the menu, for phones', () => {
    signedInAs('bernardo@example.com');
    render(<AccountMenuControl />);
    const labels = seen.props?.groups?.flatMap(g => g.items.map(i => i.label));
    expect(labels).toContain('Appearance: Dark');
    expect(labels).toEqual(expect.arrayContaining(['Dashboard', 'My projects', 'Your page']));
  });
});
