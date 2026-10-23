import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { COMPONENT_STYLES } from '@/config/design-system';
import { STATUS } from '@/config/database-constants';

type TabType = 'incoming' | 'confirmed' | 'history';
type FilterStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected';

interface TabConfig {
  id: TabType;
  label: string;
  count?: number;
}

interface BookingTabsProps {
  tabs: TabConfig[];
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  filterStatus: FilterStatus;
  onFilterChange: (status: FilterStatus) => void;
}

export default function BookingTabs({
  tabs,
  activeTab,
  onTabChange,
  filterStatus,
  onFilterChange,
}: BookingTabsProps) {
  return (
    <>
      <SegmentedControl
        label="Booking view"
        items={tabs.map(tab => ({
          value: tab.id,
          label: tab.count ? `${tab.label} (${tab.count})` : tab.label,
        }))}
        value={activeTab}
        onChange={onTabChange}
        className="mb-6"
      />

      {activeTab === 'history' && (
        <div className="mb-6 flex items-center gap-2">
          <label htmlFor="booking-history-status" className="text-sm text-fg-secondary">
            Status
          </label>
          <select
            id="booking-history-status"
            value={filterStatus}
            onChange={e => onFilterChange(e.target.value as FilterStatus)}
            className={COMPONENT_STYLES.field.control + ' min-h-11 px-3 py-2 text-base'}
          >
            <option value="all">All</option>
            <option value={STATUS.BOOKINGS.COMPLETED}>Completed</option>
            <option value={STATUS.BOOKINGS.CANCELLED}>Cancelled</option>
            <option value={STATUS.BOOKINGS.REJECTED}>Rejected</option>
          </select>
        </div>
      )}
    </>
  );
}

export type { TabType, FilterStatus, TabConfig };
