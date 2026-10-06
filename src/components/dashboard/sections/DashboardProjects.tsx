'use client';

import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { ThingRow } from '@/components/things/ThingRow';
import { DashboardSection } from './DashboardSection';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ENTITY_STATUS } from '@/config/database-constants';

/** Rows shown before "All N". Enough to recognise your work, few enough to scan. */
export const DASHBOARD_PROJECT_ROWS = 5;

interface DashboardProjectsProps {
  projects: Array<{
    id: string;
    title: string;
    status?: string;
    total_funding?: number;
    currency?: string;
  }>;
  stats: { totalRaised: number; totalSupporters: number; primaryCurrency: string };
}

/**
 * Your projects as rows, the same rows as My things. It was a grid of
 * full-width cover cards whose cover was a gradient and a single letter — one
 * project per phone screen, and the letter told you nothing the title did not.
 * The "Your Impact" tiles folded in as one line, shown only once there is
 * something to report: "CHF 0.00 raised · 0 supporters" was three stacked
 * boxes of zeros.
 */
export function DashboardProjects({ projects, stats }: DashboardProjectsProps) {
  const meta = ENTITY_REGISTRY.project;

  if (projects.length === 0) {
    return (
      <DashboardSection id="dashboard-projects" title="Your projects">
        <div className="rounded-lg border border-default bg-surface-base p-4 text-sm text-fg-secondary">
          No projects yet. Say what you want to fund above and your Cat drafts one — or{' '}
          <Link href={meta.createPath} className="font-medium text-fg-primary hover:underline">
            start one yourself
          </Link>
          .
        </div>
      </DashboardSection>
    );
  }

  const shown = projects.slice(0, DASHBOARD_PROJECT_ROWS);
  const hasNumbers = stats.totalRaised > 0 || stats.totalSupporters > 0;

  return (
    <DashboardSection
      id="dashboard-projects"
      title="Your projects"
      action={{ label: `All ${projects.length}`, href: meta.basePath }}
      note={
        hasNumbers ? (
          <>
            <CurrencyDisplay
              amount={stats.totalRaised}
              currency={stats.primaryCurrency}
              size="sm"
            />{' '}
            raised · {stats.totalSupporters}{' '}
            {stats.totalSupporters === 1 ? 'supporter' : 'supporters'}
          </>
        ) : undefined
      }
    >
      <ul className="divide-y divide-subtle rounded-lg border border-default bg-surface-base">
        {shown.map(project => (
          <ThingRow
            key={project.id}
            type="project"
            title={project.title}
            href={`${meta.publicBasePath}/${project.id}`}
            status={project.status ?? ENTITY_STATUS.DRAFT}
            subtitle={
              project.total_funding && project.total_funding > 0 ? (
                <>
                  <CurrencyDisplay
                    amount={project.total_funding}
                    currency={project.currency ?? stats.primaryCurrency}
                    size="sm"
                    className="text-xs"
                  />{' '}
                  raised
                </>
              ) : undefined
            }
          />
        ))}
      </ul>
    </DashboardSection>
  );
}

export default DashboardProjects;
