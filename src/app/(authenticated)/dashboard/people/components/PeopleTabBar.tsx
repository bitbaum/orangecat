import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';

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
  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: 'followers', label: 'Followers', count: followersCount },
    { id: 'following', label: 'Following', count: followingCount },
    { id: 'all', label: 'All Users', count: allUsersCount },
  ];

  return (
    <>
      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b border-default">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-fg-primary border-b-2 border-fg-primary'
                : 'text-fg-secondary hover:text-fg-primary dark:text-fg-secondary dark:hover:text-fg-primary'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

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
