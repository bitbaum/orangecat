'use client';

import React from 'react';
import BottomSheet from '@/components/ui/BottomSheet';
import { Check, ArrowLeft, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { TIMELINE_COPY, TIMELINE_SURFACE } from '@/config/timeline';
import { formatNumber } from '@/utils/locale';

interface Project {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string | null;
  contributor_count?: number;
}

interface ProjectSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  selectedProjects: string[];
  onToggleProject: (projectId: string) => void;
  loading?: boolean;
}

/**
 * X-style Project Selection Modal
 *
 * Matches X's "Choose audience" interface but for projects instead of groups.
 * Shows "Everyone" option and list of user's projects with selection checkmarks.
 */
export default function ProjectSelectionModal({
  isOpen,
  onClose,
  projects,
  selectedProjects,
  onToggleProject,
  loading = false,
}: ProjectSelectionModalProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      maxHeight="100dvh"
      showCloseButton={false}
      closeOnOverlayClick={true}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <button onClick={onClose} className={TIMELINE_SURFACE.iconButton} aria-label="Close">
          <ArrowLeft className="w-5 h-5 text-fg-primary" />
        </button>
        <h2 className="text-lg font-semibold text-fg-primary">Crosspost to projects</h2>
        <div className="w-9" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(100dvh_-_60px)]">
        {/* Everyone option (default - always selected) */}
        <div className="px-4 py-4 border-b border-default">
          <button
            className="flex items-center justify-between w-full min-h-11"
            disabled
            aria-label="Everyone (default)"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-fg-primary">
                <Users className="w-5 h-5 text-fg-inverted" />
              </div>
              <div className="text-left">
                <div className="text-base font-semibold text-fg-primary">Everyone</div>
                <div className="text-sm text-fg-secondary">Post to your timeline</div>
              </div>
            </div>
            <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-fg-primary">
              <Check className="w-4 h-4 text-fg-inverted" />
            </div>
          </button>
        </div>

        {/* My Projects section */}
        {projects.length > 0 && (
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-fg-primary mb-3">My Projects</h3>
            <div className="space-y-1">
              {projects.map(project => {
                const isSelected = selectedProjects.includes(project.id);
                return (
                  <button
                    key={project.id}
                    onClick={() => onToggleProject(project.id)}
                    className={cn(
                      'flex min-h-[60px] w-full items-center justify-between rounded-md px-3 py-3 transition-colors',
                      'hover:bg-surface-raised active:bg-surface-raised dark:active:bg-surface-raised',
                      isSelected && 'bg-surface-raised'
                    )}
                    aria-label={`${isSelected ? 'Deselect' : 'Select'} ${project.title}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Project icon/thumbnail */}
                      {project.thumbnail_url ? (
                        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-md">
                          <Image
                            src={project.thumbnail_url}
                            alt={project.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-surface-raised">
                          <span className="text-sm font-semibold text-fg-primary">
                            {project.title[0]?.toUpperCase() || 'P'}
                          </span>
                        </div>
                      )}

                      {/* Project info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-base font-semibold text-fg-primary truncate">
                          {project.title}
                        </div>
                        {project.contributor_count !== undefined && (
                          <div className="text-sm text-fg-secondary">
                            {formatNumber(project.contributor_count)} supporter
                            {project.contributor_count !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Checkmark */}
                    <div
                      className={cn(
                        'ml-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'border-fg-primary bg-fg-primary'
                          : 'border-strong bg-surface-page'
                      )}
                    >
                      {isSelected && <Check className="w-4 h-4 text-fg-inverted" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="text-fg-secondary text-sm">No projects available</div>
            <div className="text-fg-tertiary text-xs mt-1">
              Create a project to crosspost your updates
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="px-4 py-12 text-center">
            <div className="text-fg-secondary text-sm">{TIMELINE_COPY.loadingProjects}</div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
