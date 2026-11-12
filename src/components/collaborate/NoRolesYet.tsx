'use client';

import { Handshake, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { scrollBehavior } from '@/lib/scroll-behavior';

const WHAT =
  'Collaborate is where projects ask for help — a designer, a translator, someone with a van.';

/** /collaborate with no open roles: what the page is for and the one next step. */
export function NoRolesYet({
  hasProjects,
  onCreateProject,
}: {
  hasProjects: boolean;
  onCreateProject: () => void;
}) {
  return (
    <Card>
      <EmptyState
        icon={Handshake}
        title="No open roles yet"
        description={
          hasProjects
            ? `${WHAT} Post a role on one of your projects and people who can help will find it here.`
            : `${WHAT} Roles belong to a project, so start one first; then post the help you need.`
        }
        action={
          <Button
            onClick={
              hasProjects
                ? () => window.scrollTo({ top: 0, behavior: scrollBehavior() })
                : onCreateProject
            }
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {hasProjects ? 'Post a role' : 'Create a project'}
          </Button>
        }
      />
    </Card>
  );
}
