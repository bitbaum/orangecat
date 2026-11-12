'use client';

import React from 'react';
import { Bold, Italic, X, FolderPlus, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMELINE_CONTENT_LIMITS, TIMELINE_COPY, TIMELINE_SURFACE } from '@/config/timeline';

export interface TextFormatToolbarProps {
  onFormat: (format: 'bold' | 'italic') => void;
  variant?: 'default' | 'accent';
  size?: 'sm' | 'md';
}

export function TextFormatToolbar({
  onFormat,
  variant = 'default',
  size = 'sm',
}: TextFormatToolbarProps) {
  const baseClasses = cn(
    'flex items-center justify-center rounded-md transition-colors',
    size === 'sm' ? 'h-10 w-10' : 'min-h-11 min-w-11 p-2'
  );

  const colorClasses =
    variant === 'accent'
      ? 'text-fg-primary hover:bg-surface-raised active:bg-surface-raised/80'
      : 'text-fg-secondary hover:bg-surface-raised hover:text-fg-primary';

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onFormat('bold')}
        className={cn(baseClasses, colorClasses)}
        title="Bold (Ctrl+B)"
        aria-label="Make text bold"
      >
        <Bold className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
      <button
        type="button"
        onClick={() => onFormat('italic')}
        className={cn(baseClasses, colorClasses)}
        title="Italic (Ctrl+I)"
        aria-label="Make text italic"
      >
        <Italic className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
      </button>
    </div>
  );
}

export interface Project {
  id: string;
  title: string;
}

export interface ProjectSelectionPanelProps {
  projects: Project[];
  selectedProjects: string[];
  onToggle: (id: string) => void;
  onClose: () => void;
  isPosting: boolean;
  variant?: 'accent' | 'default';
}

export function ProjectSelectionPanel({
  projects,
  selectedProjects,
  onToggle,
  onClose,
  isPosting,
  variant = 'default',
}: ProjectSelectionPanelProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <div className={cn('mt-3 p-3', TIMELINE_SURFACE.panel)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase text-fg-secondary">
          {TIMELINE_COPY.crossPostLabel}
        </span>
        <button
          onClick={onClose}
          className={cn(TIMELINE_SURFACE.iconButton, 'sm:min-h-8 sm:min-w-8')}
          aria-label="Close project selection"
        >
          <X className="w-4 h-4 sm:w-3 sm:h-3" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {projects.map(project => (
          <button
            key={project.id}
            type="button"
            onClick={() => onToggle(project.id)}
            disabled={isPosting}
            className={cn(
              TIMELINE_SURFACE.chip,
              selectedProjects.includes(project.id)
                ? variant === 'accent'
                  ? 'border-fg-primary bg-fg-primary text-fg-inverted hover:text-fg-inverted'
                  : TIMELINE_SURFACE.chipActive
                : ''
            )}
          >
            {project.title}
          </button>
        ))}
      </div>
      {selectedProjects.length > 0 && (
        <p className="mt-2 text-xs text-fg-secondary">
          This post will appear on {selectedProjects.length} project timeline
          {selectedProjects.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export interface ProjectToggleButtonProps {
  showProjects: boolean;
  selectedCount: number;
  onToggle: () => void;
  variant?: 'default' | 'accent';
}

export function ProjectToggleButton({
  showProjects,
  selectedCount,
  onToggle,
  variant = 'default',
}: ProjectToggleButtonProps) {
  const isActive = showProjects || selectedCount > 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-md transition-colors touch-manipulation',
        isActive
          ? variant === 'accent'
            ? 'bg-surface-raised text-fg-primary ring-1 ring-border-strong'
            : 'bg-surface-raised text-fg-primary'
          : 'text-fg-secondary hover:bg-surface-raised hover:text-fg-primary'
      )}
      title="Cross-post to projects"
      aria-label="Toggle project selection"
    >
      <FolderPlus className="w-4 h-4" />
    </button>
  );
}

export interface ComposerMessagesProps {
  error?: string | null;
  success?: boolean;
  onClearError?: () => void;
  onRetry?: () => void;
  retryCount?: number;
  maxRetries?: number;
}

export function ComposerMessages({
  error,
  success,
  onClearError,
  onRetry,
  retryCount = 0,
  maxRetries = 3,
}: ComposerMessagesProps) {
  if (error) {
    return (
      <div className="mt-2 rounded-md oc-error-surface p-3">
        <div className="flex items-start gap-2">
          <div className="text-status-negative text-sm flex-1">{error}</div>
          {onClearError && (
            <button
              onClick={onClearError}
              className="text-status-negative hover:text-status-negative/80 min-h-11 min-w-11 flex items-center justify-center"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {onRetry && retryCount < maxRetries && (
          <div className="mt-2">
            <button
              onClick={onRetry}
              className="text-sm text-status-negative hover:text-status-negative underline rounded-md min-h-11 px-2 flex items-center"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (success) {
    return (
      <div className="mt-2 rounded-md border border-status-positive/20 bg-status-positive-subtle px-3 py-2 text-sm text-status-positive">
        {TIMELINE_COPY.savedPost}
      </div>
    );
  }

  return null;
}

export interface CharacterCounterProps {
  count: number;
  max?: number;
  warningThreshold?: number;
  dangerThreshold?: number;
  className?: string;
}

export function CharacterCounter({
  count,
  max = TIMELINE_CONTENT_LIMITS.post,
  warningThreshold = TIMELINE_CONTENT_LIMITS.warningAt,
  dangerThreshold = TIMELINE_CONTENT_LIMITS.dangerAt,
  className,
}: CharacterCounterProps) {
  if (count === 0) {
    return null;
  }

  const colorClass =
    count > dangerThreshold
      ? 'text-status-negative'
      : count > warningThreshold
        ? 'text-status-warning'
        : 'text-fg-tertiary';

  return (
    <div className={cn('text-sm font-medium', colorClass, className)}>
      {count}/{max}
    </div>
  );
}

export interface OfflineIndicatorProps {
  isOnline: boolean;
}

export function OfflineIndicator({ isOnline }: OfflineIndicatorProps) {
  if (isOnline) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-status-warning/30 bg-status-warning-subtle px-2 py-1 text-xs text-status-warning">
      <WifiOff className="w-3 h-3" />
      <span>Offline</span>
    </div>
  );
}

export interface ContextIndicatorProps {
  targetName: string;
}

export function ContextIndicator({ targetName }: ContextIndicatorProps) {
  return (
    <div className="mb-1.5 flex items-center">
      <span className={cn(TIMELINE_SURFACE.chip, 'py-0.5')}>To {targetName}</span>
    </div>
  );
}
