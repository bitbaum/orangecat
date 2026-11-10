'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { ChevronDown, Plus } from 'lucide-react';
import { ARTICLE_COPY } from '@/config/articles';
import type { ProjectWalls } from './useProjectWalls';

// The same sheet short posts use to cross-post to projects — one picker, one rule.
const ProjectSelectionModal = dynamic(() => import('@/components/timeline/ProjectSelectionModal'), {
  ssr: false,
  loading: () => null,
});

/**
 * "Also post on a project": closed until wanted, a text button that says what
 * it does (the OptionalNoteField shape). Nothing at all when the writer has no
 * projects — a choice with nothing to choose is a dead end.
 */
export default function ProjectWallsField({
  walls,
  disabled,
}: {
  walls: ProjectWalls;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const copy = ARTICLE_COPY.new.projects;

  const notOwnedNotice = walls.linkedProjectNotOwned ? (
    <p role="status" className="mb-0 text-sm text-fg-secondary">
      {copy.linkNotYours}
    </p>
  ) : null;

  if (walls.projects.length === 0) {
    return notOwnedNotice;
  }

  const chosen = walls.projects.filter(project => walls.selected.includes(project.id));
  const label =
    chosen.length === 0
      ? copy.add
      : chosen.length === 1
        ? copy.one(chosen[0].title)
        : copy.many(chosen.length);
  const Icon = chosen.length === 0 ? Plus : ChevronDown;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 items-center gap-1.5 self-start text-left text-sm text-fg-secondary hover:text-fg-primary disabled:opacity-50"
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        {label}
      </button>
      {notOwnedNotice}
      {open && (
        <ProjectSelectionModal
          isOpen={open}
          onClose={() => setOpen(false)}
          projects={walls.projects}
          selectedProjects={walls.selected}
          onToggleProject={walls.toggle}
          loading={walls.loading}
        />
      )}
    </div>
  );
}
