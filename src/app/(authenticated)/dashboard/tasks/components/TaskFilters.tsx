import { COMPONENT_STYLES } from '@/config/design-system';
import {
  TASK_CATEGORIES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_CATEGORY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
} from '@/config/tasks';

type TaskCategory = (typeof TASK_CATEGORIES)[keyof typeof TASK_CATEGORIES];
type TaskStatus = (typeof TASK_STATUSES)[keyof typeof TASK_STATUSES];
type TaskType = (typeof TASK_TYPES)[keyof typeof TASK_TYPES];

interface TaskFiltersProps {
  categoryFilter: TaskCategory | '';
  statusFilter: TaskStatus | '';
  typeFilter: TaskType | '';
  showArchived: boolean;
  onCategoryChange: (value: TaskCategory | '') => void;
  onStatusChange: (value: TaskStatus | '') => void;
  onTypeChange: (value: TaskType | '') => void;
  onShowArchivedChange: (value: boolean) => void;
}

export default function TaskFilters({
  categoryFilter,
  statusFilter,
  typeFilter,
  showArchived,
  onCategoryChange,
  onStatusChange,
  onTypeChange,
  onShowArchivedChange,
}: TaskFiltersProps) {
  return (
    <div
      id="task-filters"
      className="bg-surface-base rounded-lg border border-default p-4 mb-6 space-y-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label
            htmlFor="task-filter-category"
            className="block text-sm font-medium text-fg-primary mb-1"
          >
            Category
          </label>
          <select
            id="task-filter-category"
            value={categoryFilter}
            onChange={e => onCategoryChange(e.target.value as TaskCategory | '')}
            className={COMPONENT_STYLES.field.control + ' w-full min-h-11 px-3 py-2 text-base'}
          >
            <option value="">All categories</option>
            {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="task-filter-status"
            className="block text-sm font-medium text-fg-primary mb-1"
          >
            Status
          </label>
          <select
            id="task-filter-status"
            value={statusFilter}
            onChange={e => onStatusChange(e.target.value as TaskStatus | '')}
            className={COMPONENT_STYLES.field.control + ' w-full min-h-11 px-3 py-2 text-base'}
          >
            <option value="">All statuses</option>
            {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="task-filter-type"
            className="block text-sm font-medium text-fg-primary mb-1"
          >
            Type
          </label>
          <select
            id="task-filter-type"
            value={typeFilter}
            onChange={e => onTypeChange(e.target.value as TaskType | '')}
            className={COMPONENT_STYLES.field.control + ' w-full min-h-11 px-3 py-2 text-base'}
          >
            <option value="">All types</option>
            {Object.entries(TASK_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center">
        <label className="flex min-h-11 items-center gap-2 text-base text-fg-primary">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => onShowArchivedChange(e.target.checked)}
            className="h-4 w-4 rounded border-strong text-fg-primary focus:ring-ring"
          />
          <span>Show archived</span>
        </label>
      </div>
    </div>
  );
}
