// @vitest-environment jsdom
/**
 * Every group card on the signed-in Groups dashboard said "0 members", the
 * founders' own groups included: the list carried no count and the card
 * printed `count ?? 0`. A group always has its founder, so a 0 or a missing
 * count means "not known to this reader" — the card says nothing then.
 */
import { render, screen } from '@testing-library/react';
import { GroupCard } from '@/components/groups/GroupCard';
import type { GroupWithRelations } from '@/types/group';

const group = (memberCount?: number) =>
  ({
    id: 'g1',
    name: 'Orange Cat',
    slug: 'orange-cat',
    label: 'circle',
    description: 'Bitcoin-powered crowdfunding platform',
    is_public: true,
    tags: [],
    ...(memberCount === undefined ? {} : { member_count: memberCount }),
  }) as unknown as GroupWithRelations;

describe('a group card’s member count', () => {
  it('says how many members there are, in the right number', () => {
    const { rerender } = render(<GroupCard group={group(1)} />);
    expect(screen.getByText('1 member')).toBeInTheDocument();
    rerender(<GroupCard group={group(3)} />);
    expect(screen.getByText('3 members')).toBeInTheDocument();
  });

  it('says nothing, never "0 members", when the count is not known', () => {
    const { rerender } = render(<GroupCard group={group()} />);
    expect(screen.queryByText(/members?$/)).toBeNull();
    rerender(<GroupCard group={group(0)} />);
    expect(screen.queryByText(/0 members/)).toBeNull();
    expect(screen.getByText('Orange Cat')).toBeInTheDocument();
  });
});
