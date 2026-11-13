import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';

type TabType = 'following' | 'followers' | 'all';

interface PeopleTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  followingCount: number;
  followersCount: number;
  allUsersCount: number;
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export default function PeopleTabBar({
  activeTab,
  onTabChange,
  followingCount,
  followersCount,
  allUsersCount,
  searchTerm,
  onSearchChange,
}: PeopleTabBarProps) {
  // Three equal cells of the shared control: the hand-rolled tabs, with the
  // count inside each label, wrapped to two lines at 390px. The count of the
  // chosen list moves under the row.
  const counts: Record<TabType, number> = {
    followers: followersCount,
    following: followingCount,
    all: allUsersCount,
  };
  const count = counts[activeTab];

  return (
    <>
      <SegmentedControl
        label="People"
        className="mb-2"
        items={[
          { value: 'followers', label: 'Followers' },
          { value: 'following', label: 'Following' },
          { value: 'all', label: 'Everyone' },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <p className="mb-4 text-xs text-fg-secondary">
        {count} {count === 1 ? 'person' : 'people'}
      </p>

      {/* Search */}
      <div className="mb-6">
        <div className="max-w-md">
          <Input
            icon={Search}
            aria-label="Search people"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={
              activeTab === 'all'
                ? 'Search all users\u2026'
                : activeTab === 'following'
                  ? 'Search following\u2026'
                  : 'Search followers\u2026'
            }
          />
        </div>
      </div>
    </>
  );
}
