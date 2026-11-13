import { BarChart3, ChevronDown, ChevronUp, Filter, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { GRADIENTS } from '@/config/gradients';
import { ROUTES } from '@/config/routes';

interface TasksHeaderActionsProps {
  showFilters: boolean;
  onToggleFilters: () => void;
}

/** The tasks page header: analytics, the filter toggle and "Create Task". */
export default function TasksHeaderActions({
  showFilters,
  onToggleFilters,
}: TasksHeaderActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        href={ROUTES.DASHBOARD.TASKS_ANALYTICS}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <BarChart3 className="h-4 w-4" aria-hidden="true" />
        <span>Analytics</span>
      </Button>
      <Button
        onClick={onToggleFilters}
        aria-expanded={showFilters}
        aria-controls="task-filters"
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        <Filter className="h-4 w-4" />
        <span>Filter</span>
        {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      <Button
        href={ROUTES.DASHBOARD.TASKS_NEW}
        className={`flex items-center gap-2 ${GRADIENTS.brandTiffanyDark}`}
      >
        <Plus className="h-4 w-4" />
        <span>Create Task</span>
      </Button>
    </div>
  );
}
