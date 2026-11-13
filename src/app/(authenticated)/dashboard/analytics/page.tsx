'use client';

import { useEffect, useState } from 'react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useProjectStore } from '@/stores/projectStore';
import EntityListShell from '@/components/entity/EntityListShell';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import Loading from '@/components/Loading';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { ROUTES } from '@/config/routes';
import { AlertCircle, BarChart3, TrendingUp, Users, DollarSign, Target, Zap } from 'lucide-react';
import AnalyticsMetricsGrid from './components/AnalyticsMetricsGrid';
import type { AnalyticsMetric } from './components/AnalyticsMetricsGrid';
import ProjectPerformanceTable from './components/ProjectPerformanceTable';
import type { ProjectPerformance } from './components/ProjectPerformanceTable';
import AnalyticsInsights from './components/AnalyticsInsights';

// One header frame (EntityListShell → PageHeader) in every state: the page
// used to hand-build its own breadcrumb and a smaller <h1> three times.
const ANALYTICS_TITLE = 'Project Analytics';
const ANALYTICS_DESCRIPTION = 'Track your fundraising performance and insights';

type TimeRange = '7d' | '30d' | '90d' | 'all';
const TIME_RANGES: readonly { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'all', label: 'All Time' },
];

export default function AnalyticsPage() {
  const { user, isLoading: authLoading } = useRequireAuth();
  const {
    projects,
    loadProjects,
    isLoading: projectLoading,
    error: projectsError,
  } = useProjectStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedProject, setSelectedProject] = useState<string>('all');

  useEffect(() => {
    if (user?.id) {
      loadProjects(user.id);
    }
  }, [user?.id, loadProjects]);

  if (authLoading || projectLoading) {
    return <Loading fullScreen />;
  }

  // Fetch failed — show a real error surface instead of rendering zeros as data.
  if (projectsError) {
    return (
      <EntityListShell title={ANALYTICS_TITLE} description={ANALYTICS_DESCRIPTION}>
        <div className="oc-error-surface">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-base font-semibold mb-1">Couldn&apos;t load your analytics</h2>
              <p className="text-sm mb-3">{projectsError}</p>
              <Button variant="outline" size="sm" onClick={() => user?.id && loadProjects(user.id)}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      </EntityListShell>
    );
  }

  // No projects at all — zero metrics would be fake insight, so say so honestly.
  if (projects.length === 0) {
    return (
      <EntityListShell title={ANALYTICS_TITLE} description={ANALYTICS_DESCRIPTION}>
        <EmptyState
          icon={BarChart3}
          title="No activity to analyze yet"
          description="Create your first project and its funding performance will show up here."
          action={
            <Button href={ROUTES.DASHBOARD.PROJECTS_CREATE} variant="outline">
              Create a project
            </Button>
          }
        />
      </EntityListShell>
    );
  }

  const getFilteredProjects = () => {
    let filtered = [...projects];

    if (timeRange !== 'all') {
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(p => new Date(p.created_at) >= cutoff);
    }

    if (selectedProject !== 'all') {
      filtered = filtered.filter(p => p.id === selectedProject);
    }

    return filtered;
  };

  const calculateMetrics = (): AnalyticsMetric[] => {
    const filtered = getFilteredProjects();
    const activeProjects = filtered.filter(c => c.isActive);
    const totalRaised = filtered.reduce((sum, c) => sum + (c.total_funding || 0), 0);
    const totalSupporters = filtered.reduce((sum, c) => sum + (c.contributor_count || 0), 0);
    const avgContribution = totalSupporters > 0 ? totalRaised / totalSupporters : 0;
    const successRate =
      filtered.length > 0
        ? (filtered.filter(c => c.goal_amount && c.total_funding >= c.goal_amount).length /
            filtered.length) *
          100
        : 0;

    return [
      {
        label: 'Total Raised',
        value: totalRaised,
        format: 'currency',
        icon: DollarSign,
        color: 'text-status-positive',
      },
      {
        label: 'Active Projects',
        value: activeProjects.length,
        icon: Target,
        color: 'text-fg-primary',
      },
      { label: 'Total Supporters', value: totalSupporters, icon: Users, color: 'text-fg-primary' },
      {
        label: 'Avg Contribution',
        value: avgContribution,
        format: 'currency',
        icon: TrendingUp,
        color: 'text-fg-primary',
      },
      {
        label: 'Success Rate',
        value: `${successRate.toFixed(1)}%`,
        icon: Zap,
        color: 'text-fg-primary',
      },
    ];
  };

  const getProjectPerformance = (): ProjectPerformance[] => {
    return getFilteredProjects().map(project => ({
      id: project.id,
      title: project.title || 'Untitled Project',
      totalRaised: project.total_funding || 0,
      goalAmount: project.goal_amount || 0,
      supporters: project.contributor_count || 0,
      avgContribution:
        project.contributor_count > 0
          ? (project.total_funding || 0) / project.contributor_count
          : 0,
      daysActive: Math.floor(
        (Date.now() - new Date(project.created_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    }));
  };

  const filteredProjects = getFilteredProjects();
  const metrics = calculateMetrics();
  const projectPerformance = getProjectPerformance();

  return (
    <EntityListShell
      title={ANALYTICS_TITLE}
      description={ANALYTICS_DESCRIPTION}
      headerActions={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SegmentedControl
            label="Time range"
            items={TIME_RANGES}
            value={timeRange}
            onChange={setTimeRange}
          />
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            aria-label="Project"
            className="min-h-11 rounded-lg border border-strong bg-surface-base px-3 py-2 text-sm text-fg-primary focus:border-interactive focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Projects</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.title || 'Untitled Project'}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <AnalyticsMetricsGrid metrics={metrics} />
      <ProjectPerformanceTable projects={projectPerformance} />
      <AnalyticsInsights projects={filteredProjects} />
    </EntityListShell>
  );
}
