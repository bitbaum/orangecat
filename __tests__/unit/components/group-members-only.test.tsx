// @vitest-environment jsdom
/**
 * Someone outside a "Members only" group sees its name, its label and a plain
 * line that only members see the rest, with a way in: sign in when signed out,
 * an invitation when signed in. The members, wallets and the pay card are not
 * rendered, and the members and wallets are not even asked for.
 *
 * On 2026-11-12 a listed members-only group showed a signed-out visitor its
 * description, its founder's handle under Members, its Wallets, Events,
 * Proposals and Activity tabs, and a live pay card.
 */

import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { GroupDetail } from '@/components/groups/GroupDetail';
import type * as UseGroupDetailModule from '@/components/groups/useGroupDetail';

const auth = vi.hoisted(() => ({ user: null as null | { id: string }, hydrated: true }));
const service = vi.hoisted(() => ({
  getGroup: vi.fn(),
  getGroupMembers: vi.fn(async () => ({ success: true, members: [] })),
  getGroupWallets: vi.fn(async () => ({ success: true, wallets: [] })),
}));
const membership = vi.hoisted(() => ({ isGroupMember: vi.fn(async () => false) }));
const detail = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: auth.user, hydrated: auth.hydrated }),
}));
vi.mock('@/services/groups', () => ({ default: service }));
vi.mock('@/services/groups/utils/helpers', () => membership);
vi.mock('@/services/groups/permissions', () => ({
  checkGroupPermission: vi.fn(async () => false),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/groups/useGroupDetail', () => ({ useGroupDetail: () => detail.state }));

const membersOnlyGroup = {
  id: 'g1',
  slug: 'record-shop',
  name: 'Record Shop',
  description: 'Vinyl, in the heart of town.',
  label: 'company',
  is_public: true,
  visibility: 'members_only',
  governance_preset: 'consensus',
  created_by: 'founder',
};
const openGroup = { ...membersOnlyGroup, visibility: 'public' };

async function realHook() {
  const mod = await vi.importActual<typeof UseGroupDetailModule>(
    '@/components/groups/useGroupDetail'
  );
  return mod.useGroupDetail;
}

async function load(group: typeof membersOnlyGroup) {
  service.getGroup.mockResolvedValue({ success: true, group });
  const useGroupDetail = await realHook();
  const { result } = renderHook(() => useGroupDetail(group.slug));
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null;
  auth.hydrated = true;
  membership.isGroupMember.mockResolvedValue(false);
});

describe('useGroupDetail while auth is still arriving', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(r => (resolve = r));
    return { promise, resolve };
  }

  it('decides nothing before auth has hydrated', async () => {
    auth.hydrated = false;
    service.getGroup.mockResolvedValue({ success: true, group: membersOnlyGroup });
    const useGroupDetail = await realHook();
    const { result, rerender } = renderHook(() => useGroupDetail(membersOnlyGroup.slug));
    expect(service.getGroup).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);

    auth.hydrated = true;
    auth.user = { id: 'member' };
    membership.isGroupMember.mockResolvedValue(true);
    rerender();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canSeeContent).toBe(true);
  });

  it('lets a load for the real user win over a slower one started before it', async () => {
    // First load runs signed out and its group read is slow; the second runs
    // for the member and finishes first. The stale one must not land last.
    const slow = deferred<{ success: boolean; group: typeof membersOnlyGroup }>();
    service.getGroup
      .mockImplementationOnce(() => slow.promise)
      .mockResolvedValue({ success: true, group: membersOnlyGroup });
    const useGroupDetail = await realHook();
    const { result, rerender } = renderHook(() => useGroupDetail(membersOnlyGroup.slug));

    auth.user = { id: 'member' };
    membership.isGroupMember.mockResolvedValue(true);
    rerender();
    await waitFor(() => expect(result.current.canSeeContent).toBe(true));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      slow.resolve({ success: true, group: membersOnlyGroup });
      await slow.promise;
    });
    expect(result.current.canSeeContent).toBe(true);
    expect(result.current.loading).toBe(false);
  });
});

describe('useGroupDetail on a listed members-only group', () => {
  it('asks a signed-out visitor for nothing past the group itself', async () => {
    const state = await load(membersOnlyGroup);
    expect(state.canSeeContent).toBe(false);
    expect(service.getGroupMembers).not.toHaveBeenCalled();
    expect(service.getGroupWallets).not.toHaveBeenCalled();
  });

  it('asks a signed-in non-member for nothing past the group itself', async () => {
    auth.user = { id: 'stranger' };
    const state = await load(membersOnlyGroup);
    expect(membership.isGroupMember).toHaveBeenCalledWith('g1', 'stranger');
    expect(state.canSeeContent).toBe(false);
    expect(service.getGroupMembers).not.toHaveBeenCalled();
    expect(service.getGroupWallets).not.toHaveBeenCalled();
  });

  it('loads everything for a member', async () => {
    auth.user = { id: 'member' };
    membership.isGroupMember.mockResolvedValue(true);
    const state = await load(membersOnlyGroup);
    expect(state.canSeeContent).toBe(true);
    expect(service.getGroupMembers).toHaveBeenCalledWith('g1');
    expect(service.getGroupWallets).toHaveBeenCalledWith('g1');
  });

  it('loads everything for anyone when the group is public', async () => {
    const state = await load(openGroup);
    expect(state.canSeeContent).toBe(true);
    expect(service.getGroupMembers).toHaveBeenCalledWith('g1');
  });
});

describe('GroupDetail for someone outside a members-only group', () => {
  const outsider = (signedIn: boolean) => {
    detail.state = {
      user: signedIn ? { id: 'stranger' } : null,
      group: membersOnlyGroup,
      members: [],
      wallets: [],
      loading: false,
      error: null,
      activeTab: 'overview',
      setActiveTab: vi.fn(),
      canCreateProposal: false,
      canSeeContent: false,
      loadGroupData: vi.fn(),
      labelConfig: { name: 'Company' },
      governanceConfig: null,
      LabelIcon: () => null,
      isOwner: false,
      hasGovernanceFeatures: true,
    };
  };

  it('shows the name, the label and that only members see the rest', () => {
    outsider(false);
    render(<GroupDetail groupSlug="record-shop" />);
    expect(screen.getByRole('heading', { name: 'Record Shop' })).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText(/Only members see this group's content/)).toBeInTheDocument();
  });

  it('shows none of the content', () => {
    outsider(false);
    render(<GroupDetail groupSlug="record-shop" />);
    expect(screen.queryByText(/Vinyl, in the heart of town/)).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText(/Members \(/)).toBeNull();
    expect(screen.queryByText(/Support with Bitcoin/)).toBeNull();
    expect(screen.queryByText(/Visibility/)).toBeNull();
  });

  it('sends a signed-out visitor through sign-in and back to the group', () => {
    outsider(false);
    render(<GroupDetail groupSlug="record-shop" />);
    const signIn = screen.getByRole('link', { name: 'Sign in' });
    expect(signIn.getAttribute('href')).toContain('/auth?mode=login&from=');
    expect(decodeURIComponent(signIn.getAttribute('href') ?? '')).toContain('/groups/record-shop');
  });

  it('tells a signed-in non-member that joining takes an invitation', () => {
    outsider(true);
    render(<GroupDetail groupSlug="record-shop" />);
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(screen.getByText(/ask the group for an invitation/)).toBeInTheDocument();
  });
});
