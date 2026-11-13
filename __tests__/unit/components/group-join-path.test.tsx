// @vitest-environment jsdom
/**
 * "Join Group" is offered only where joining can succeed, and signed out it
 * leads to sign-in and back to the group. On 2026-11-12 every public group's
 * Members tab showed the button to everyone: signed out it answered
 * "Authentication required" with no way to sign in, and signed in the insert
 * was refused by group_members' policy.
 */

import { render, screen } from '@testing-library/react';

const auth = vi.hoisted(() => ({
  value: { user: null as { id: string } | null, hydrated: true },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.value }));
vi.mock('@/services/groups', () => ({ default: { joinGroup: vi.fn() } }));
vi.mock('@/components/groups/InviteMemberDialog', () => ({ InviteMemberDialog: () => null }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { GroupMembers } from '@/components/groups/GroupMembers';
import { GroupJoinButton } from '@/components/groups/GroupJoinButton';
import { GroupDetailSidebar } from '@/components/groups/GroupDetailSidebar';
import type { GroupMember } from '@/types/group';

const founder = {
  id: 'm1',
  group_id: 'g1',
  user_id: 'founder',
  role: 'founder',
  username: 'cato',
  display_name: 'Cato',
} as unknown as GroupMember;

function renderMembers(openToJoin: boolean) {
  return render(
    <GroupMembers groupId="g1" groupSlug="bike-club" members={[founder]} openToJoin={openToJoin} />
  );
}

describe('the way into a group', () => {
  it('signed out, an open group says "Sign in to join" and comes back to the group', () => {
    auth.value = { user: null, hydrated: true };
    renderMembers(true);

    expect(screen.queryByRole('button', { name: /join group/i })).toBeNull();
    const link = screen.getByRole('link', { name: /sign in to join/i });
    expect(link.getAttribute('href')).toBe('/auth?mode=login&from=%2Fgroups%2Fbike-club');
  });

  it('signed in, a non-member of an open group can press Join Group', () => {
    auth.value = { user: { id: 'someone' }, hydrated: true };
    renderMembers(true);

    expect(screen.getByRole('button', { name: /join group/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /sign in to join/i })).toBeNull();
  });

  it('a group that takes members by invitation offers no Join, signed in or out', () => {
    for (const user of [null, { id: 'someone' }]) {
      auth.value = { user, hydrated: true };
      const { unmount } = renderMembers(false);
      expect(screen.queryByRole('button', { name: /join group/i })).toBeNull();
      expect(screen.queryByRole('link', { name: /sign in to join/i })).toBeNull();
      unmount();
    }
  });

  it('a member is not offered Join', () => {
    auth.value = { user: { id: 'founder' }, hydrated: true };
    renderMembers(true);

    expect(screen.queryByRole('button', { name: /join group/i })).toBeNull();
  });

  it('says nothing until it knows who is signed in', () => {
    auth.value = { user: null, hydrated: false };
    renderMembers(true);

    expect(screen.queryByRole('link', { name: /sign in to join/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /join group/i })).toBeNull();
  });

  it('is offered in the page header too, where a visitor lands (the Overview tab)', () => {
    auth.value = { user: null, hydrated: true };
    render(<GroupJoinButton groupId="g1" groupSlug="bike-club" openToJoin isMember={false} />);
    expect(screen.getByRole('link', { name: /sign in to join/i }).getAttribute('href')).toBe(
      '/auth?mode=login&from=%2Fgroups%2Fbike-club'
    );
  });
});

describe('the group sidebar a visitor reads', () => {
  const group = {
    id: 'g1',
    slug: 'bike-club',
    name: 'Bike club',
    label: 'club',
    visibility: 'public',
    is_public: true,
    governance_preset: 'consensus',
  } as never;

  it('leaves the owner’s settings (label, visibility, listed) to the owner', () => {
    const { unmount } = render(
      <GroupDetailSidebar
        group={group}
        members={[founder]}
        wallets={null}
        labelConfig={null}
        governanceConfig={null}
        LabelIcon={() => null}
      />
    );
    expect(screen.queryByText('Visibility')).toBeNull();
    expect(screen.queryByText('Listed')).toBeNull();
    // One member is a member, not "1 Members".
    expect(screen.getByText('Member')).toBeTruthy();
    unmount();

    render(
      <GroupDetailSidebar
        group={group}
        members={[founder]}
        wallets={null}
        labelConfig={null}
        governanceConfig={null}
        LabelIcon={() => null}
        isOwner
      />
    );
    expect(screen.getByText('Visibility')).toBeTruthy();
    expect(screen.getByText('Listed')).toBeTruthy();
  });
});
