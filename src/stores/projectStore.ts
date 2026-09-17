/**
 * PROJECT STORE - MVP Implementation
 *
 * Simplified store for managing projects (fundraising campaigns)
 * - Fetch projects for a user
 * - Basic CRUD operations
 * - Simple state management with Zustand
 */

import { fromTable } from '@/lib/supabase/untyped';
import { create } from 'zustand';
import { logger } from '@/utils/logger';
import supabase from '@/lib/supabase/browser';
import { ENTITY_TABLE_NAMES, getTableName } from '@/config/entity-registry';
import { PROJECT_STATUS, type ProjectStatus } from '@/config/project-statuses';
import { DATABASE_TABLES } from '@/config/database-tables';
import { API_ROUTES } from '@/config/api-routes';

// Use existing FundingPage type from funding.ts
import type { FundingPage } from '@/types/funding';
import type { Database } from '@/types/database';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export interface Project extends FundingPage {
  isDraft: boolean;
  isActive: boolean;
  isPaused: boolean;
  status?: ProjectStatus;
  creator_name?: string;
}

export interface ProjectState {
  // DATA
  projects: Project[];

  // STATUS
  isLoading: boolean;
  error: string | null;

  // COMPUTED
  drafts: Project[];
  activeProjects: Project[];

  // ACTIONS
  loadProjects: (userId: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProjectStatus: (id: string, status: ProjectStatus) => Promise<void>;
  getProjectById: (id: string) => Project | undefined;
  getStats: () => { totalProjects: number; totalActive: number };

  // UTILITIES
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // DATA
  projects: [],

  // STATUS
  isLoading: false,
  error: null,

  // COMPUTED
  get drafts() {
    return get().projects.filter(p => p.isDraft);
  },

  get activeProjects() {
    return get().projects.filter(p => p.isActive && !p.isDraft);
  },

  // ACTIONS
  loadProjects: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Resolve user_id to actor_id for ownership filtering

      const { data: actor } = (await fromTable(supabase, DATABASE_TABLES.ACTORS)
        .select('id')
        .eq('user_id', userId)
        .eq('actor_type', 'user')
        .maybeSingle()) as { data: { id: string } | null };

      if (!actor) {
        // No actor yet — no projects to load
        set({ projects: [], isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from(getTableName('project'))
        .select('*')
        .eq('actor_id', actor.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // A `user_projects` row plus the view-model fields this mapper computes
      // below (isDraft/isActive/total_funding/...), which the row itself lacks.
      type RawProjectRow =
        Database['public']['Tables'][(typeof ENTITY_TABLE_NAMES)['project']]['Row'] &
          Partial<Project> & {
            raised_amount?: number;
          };
      const projects: Project[] = ((data || []) as unknown as RawProjectRow[]).map(project => ({
        ...project,
        // Map database fields to FundingPage interface
        total_funding: project.raised_amount ?? project.total_funding ?? 0,
        current_amount: project.raised_amount ?? project.total_funding ?? 0,
        raised_amount: project.raised_amount ?? 0,
        isDraft: project.status === PROJECT_STATUS.DRAFT,
        isActive: project.status === PROJECT_STATUS.ACTIVE,
        isPaused: project.status === PROJECT_STATUS.PAUSED,
        // Ensure boolean fields exist
        is_active: project.status === PROJECT_STATUS.ACTIVE,
        is_public: project.status !== PROJECT_STATUS.DRAFT,
        contributor_count: project.contributor_count ?? 0,
      }));

      set({ projects, isLoading: false });
      logger.info(`Loaded ${projects.length} projects for user ${userId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load projects';
      logger.error('Failed to load projects:', error);
      set({ error: message, isLoading: false });
    }
  },

  deleteProject: async (id: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(API_ROUTES.PROJECTS.BY_ID(id), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(errorData, 'Failed to delete project'));
      }

      // Remove the project from the store
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        isLoading: false,
      }));

      logger.info(`Deleted project ${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project';
      logger.error('Failed to delete project:', error);
      set({ error: message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },

  updateProjectStatus: async (id: string, status: ProjectStatus) => {
    set({ isLoading: true, error: null });

    try {
      const response = await fetch(API_ROUTES.PROJECTS.STATUS(id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(errorData, 'Failed to update project status'));
      }

      const { data: updatedProject } = await response.json();

      // Update the project in the store
      set(state => ({
        projects: state.projects.map(p =>
          p.id === id
            ? {
                ...p,
                ...updatedProject,
                status: updatedProject.status,
                isDraft: updatedProject.status === PROJECT_STATUS.DRAFT,
                isActive: updatedProject.status === PROJECT_STATUS.ACTIVE,
                isPaused: updatedProject.status === PROJECT_STATUS.PAUSED,
                is_active: updatedProject.status === PROJECT_STATUS.ACTIVE,
                is_public: updatedProject.status !== PROJECT_STATUS.DRAFT,
              }
            : p
        ),
        isLoading: false,
      }));

      logger.info(`Updated project ${id} status to ${status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update project status';
      logger.error('Failed to update project status:', error);
      set({ error: message, isLoading: false });
      throw error; // Re-throw so the UI can handle it
    }
  },

  getProjectById: (id: string) => {
    return get().projects.find(p => p.id === id);
  },

  getStats: () => {
    const state = get();
    return {
      totalProjects: state.projects.length,
      totalActive: state.activeProjects.length,
    };
  },

  reset: () => {
    set({
      projects: [],
      isLoading: false,
      error: null,
    });
  },
}));
