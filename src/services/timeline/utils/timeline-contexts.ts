import type { TimelineVisibility } from '@/types/timeline';

/** One wall a post appears on: a profile, a project, or the community feed. */
export interface TimelineContext {
  timeline_type: 'profile' | 'project' | 'community';
  timeline_owner_id: string | null;
}

/**
 * The walls a post goes to: its own subject's wall, each chosen project's wall,
 * and the community feed when it is public and not a reply. Short posts and
 * articles both build their contexts here, so "also post on a project" means the
 * same thing for both.
 */
export function buildTimelineContexts(
  subjectType: string,
  subjectId: string | undefined,
  userId: string,
  selectedProjects: string[],
  visibility: TimelineVisibility,
  parentEventId?: string
): TimelineContext[] {
  const contexts: TimelineContext[] = [];

  contexts.push({
    timeline_type: subjectType as 'profile' | 'project',
    timeline_owner_id: subjectId || userId,
  });

  selectedProjects.forEach(projectId => {
    contexts.push({
      timeline_type: 'project',
      timeline_owner_id: projectId,
    });
  });

  if (visibility === 'public' && !parentEventId) {
    contexts.push({
      timeline_type: 'community',
      timeline_owner_id: null,
    });
  }

  return contexts;
}
