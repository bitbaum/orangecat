'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchUserProjects, type UserProject } from '@/services/timeline/utils/post-composer';
import { resolveProjectParam } from '@/services/articles/project-walls';
import { logger } from '@/utils/logger';

export interface ProjectWalls {
  /** The writer's own projects — the list short posts cross-post to. Empty while loading. */
  projects: UserProject[];
  loading: boolean;
  selected: string[];
  toggle: (projectId: string) => void;
  /** A `?project=` link named a project that is not one of the writer's. */
  linkedProjectNotOwned: boolean;
}

/**
 * Projects an article can also be posted on, with the one a `?project=` link
 * names already chosen when it is the writer's own. Off when editing: an
 * edit keeps the walls the article was published on.
 */
export function useProjectWalls(
  userId: string,
  projectParam: string | null,
  enabled: boolean
): ProjectWalls {
  const [projects, setProjects] = useState<UserProject[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [selected, setSelected] = useState<string[]>([]);
  const [linkedProjectNotOwned, setLinkedProjectNotOwned] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    fetchUserProjects(userId)
      .then(owned => {
        if (cancelled) {
          return;
        }
        setProjects(owned);
        const linked = resolveProjectParam(projectParam, owned);
        if (linked) {
          setSelected(current => (current.includes(linked) ? current : [...current, linked]));
        }
        setLinkedProjectNotOwned(!!projectParam?.trim() && !linked);
      })
      .catch(err => {
        logger.error('Failed to load projects for an article', err, 'ArticleComposer');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, projectParam, enabled]);

  const toggle = useCallback((projectId: string) => {
    setSelected(current =>
      current.includes(projectId) ? current.filter(id => id !== projectId) : [...current, projectId]
    );
  }, []);

  return { projects, loading, selected, toggle, linkedProjectNotOwned };
}
