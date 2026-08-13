'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Eye, Star, Cat } from 'lucide-react';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { ROUTES } from '@/config/routes';

/**
 * DashboardQuickActions - Quick navigation shortcuts for users who have projects.
 * Only rendered when hasProjects === true; new-user guidance lives in DashboardJourney.
 */
export function DashboardQuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Common tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link href={ROUTES.DASHBOARD.CAT}>
            <Button
              variant="outline"
              className="min-h-11 w-full justify-start hover:border-strong hover:bg-surface-raised"
            >
              <Cat className="w-4 h-4 mr-2" />
              Ask Cat
            </Button>
          </Link>
          <Link href={ENTITY_REGISTRY.project.basePath}>
            <Button variant="outline" className="min-h-11 w-full justify-start">
              <Eye className="w-4 h-4 mr-2" />
              Manage Projects
            </Button>
          </Link>
          <Link href={ROUTES.DASHBOARD.INFO_EDIT}>
            <Button variant="outline" className="min-h-11 w-full justify-start">
              <Star className="w-4 h-4 mr-2" />
              Update Profile
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default DashboardQuickActions;
