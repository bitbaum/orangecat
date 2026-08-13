'use client';

import EntityDashboardPage from '@/components/entity/EntityDashboardPage';
import FleetCrownBuildCta from '@/components/integrations/FleetCrownBuildCta';
import Button from '@/components/ui/Button';
import { Target, Heart } from 'lucide-react';
import { projectEntityConfig, type ProjectListItem } from '@/config/entities/projects';
import { PROJECT_STATUS } from '@/config/project-statuses';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';

export default function ProjectsDashboardPage() {
  return (
    <EntityDashboardPage<ProjectListItem>
      config={projectEntityConfig}
      title="My Projects"
      description="Manage your projects and track funding"
      createButtonLabel="Create Project"
      headerContent={<FleetCrownBuildCta variant="banner" />}
      tabs={[
        { id: 'my-projects', label: 'My Projects', icon: Target },
        {
          id: 'favorites',
          label: 'Favorites',
          icon: Heart,
          apiEndpoint: API_ROUTES.PROJECTS.FAVORITES,
          allowBulkSelect: false,
          hideStatusFilter: true,
          emptyState: {
            title: 'No favorites yet',
            description: 'Start exploring projects and save your favorites to see them here.',
            action: (
              <Button href={ROUTES.DISCOVER_TYPE('projects')} variant="outline">
                Discover Projects
              </Button>
            ),
          },
        },
      ]}
      searchableFields={['title', 'description', 'category', 'tags']}
      searchPlaceholder="Search projects..."
      statusFilter={{
        options: [
          { value: 'all', label: 'All Status' },
          { value: PROJECT_STATUS.DRAFT, label: 'Draft' },
          { value: PROJECT_STATUS.ACTIVE, label: 'Active' },
          { value: PROJECT_STATUS.PAUSED, label: 'Paused' },
          { value: PROJECT_STATUS.COMPLETED, label: 'Completed' },
          { value: PROJECT_STATUS.CANCELLED, label: 'Cancelled' },
        ],
        // Projects expose isDraft/isActive/isPaused booleans derived from
        // status — use them where available, fall back to raw status match.
        match: (item, value) => {
          if (value === PROJECT_STATUS.DRAFT) {
            return !!item.isDraft;
          }
          if (value === PROJECT_STATUS.ACTIVE) {
            return !!item.isActive;
          }
          if (value === PROJECT_STATUS.PAUSED) {
            return !!item.isPaused;
          }
          return item.status === value;
        },
      }}
    />
  );
}
