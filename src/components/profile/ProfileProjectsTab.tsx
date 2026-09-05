'use client';
import { logger } from '@/utils/logger';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Target, ArrowRight } from 'lucide-react';
import type { ScalableProfile } from '@/services/profile/types';
import Button from '@/components/ui/Button';
import ProfileProjectCard from '@/components/profile/ProfileProjectCard';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { PROJECT_STATUS } from '@/config/project-statuses';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

// OrangeCat + FleetCrown: FleetCrown is the "customer" of OrangeCat via stakeholder graph.
// Both are projects on this platform for Cato, with shared wallet.
// Makes the stack work for FleetCrown as customer. See stakeholder_relationships and /api/stakeholders.

// Extended project list item for profile display
interface ProfileProjectItem {
  id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  goal_amount?: number | null;
  raised_amount?: number;
  bitcoin_balance_btc?: number;
  bitcoin_address?: string | null;
  currency?: string;
  category?: string;
  status?: string;
  created_at: string;
}

interface ProfileProjectsTabProps {
  profile: ScalableProfile;
  isOwnProfile?: boolean;
}

/**
 * ProfileProjectsTab Component
 *
 * Displays user's projects in a tab context.
 * Reuses project display logic for DRY principle.
 */
export default function ProfileProjectsTab({ profile, isOwnProfile }: ProfileProjectsTabProps) {
  const [projects, setProjects] = useState<ProfileProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!profile.id) {
      return;
    }
    const controller = new AbortController();
    const fetchProjects = async () => {
      try {
        setLoading(true);
        setError(false);
        const response = await fetch(API_ROUTES.PROFILES.PROJECTS(profile.id), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Failed to load projects (${response.status})`);
        }
        const result = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        if (result.success && result.data && Array.isArray(result.data.data)) {
          setProjects(result.data.data);
        }
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          return;
        }
        logger.error('Failed to fetch projects:', error);
        setError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchProjects();
    return () => controller.abort();
  }, [profile.id, reloadKey]);

  if (loading) {
    return <div className="text-fg-secondary text-sm py-8 text-center">Loading projects...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Target className="w-12 h-12 mx-auto mb-4 text-fg-tertiary" />
        <h3 className="text-lg font-semibold text-fg-primary mb-2">Couldn’t load projects</h3>
        <p className="text-fg-secondary mb-6">Something went wrong fetching projects.</p>
        <Button variant="outline" onClick={() => setReloadKey(k => k + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  // Filter out drafts for public display
  const publicProjects = projects.filter(
    project => project.status?.toLowerCase() !== PROJECT_STATUS.DRAFT
  );

  if (publicProjects.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 mx-auto mb-4 text-fg-tertiary dark:text-fg-secondary" />
        <h3 className="text-lg font-semibold text-fg-primary mb-2">No Projects Yet</h3>
        <p className="text-fg-secondary mb-6">
          {isOwnProfile ? "You haven't published any projects yet" : 'No projects to display'}
        </p>
        {isOwnProfile && (
          <Link href={ROUTES.PROJECTS.CREATE}>
            <Button>
              <Target className="w-4 h-4 mr-2" />
              Create Your First Project
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with count */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-fg-primary flex items-center gap-2">
          <Target className="w-5 h-5 text-fg-secondary" />
          {publicProjects.length}{' '}
          {publicProjects.length === 1
            ? ENTITY_REGISTRY.project.name
            : ENTITY_REGISTRY.project.namePlural}
        </h3>
        {isOwnProfile && (
          <Link href={ROUTES.DASHBOARD.PROJECTS}>
            <Button variant="ghost" size="sm">
              Manage All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        )}
      </div>

      {/* Projects Grid */}
      <div className="space-y-4">
        {publicProjects.map(project => (
          <ProfileProjectCard
            key={project.id}
            project={{
              id: project.id,
              title: project.title,
              description: project.description,
              imageUrl: project.thumbnail_url,
              goalAmount: project.goal_amount,
              raisedAmount: project.raised_amount,
              balanceBtc: project.bitcoin_balance_btc,
              currency: project.currency,
              category: project.category,
              status: project.status,
              hasWallet: !!project.bitcoin_address,
              createdAt: project.created_at,
            }}
          />
        ))}
      </div>
    </div>
  );
}
