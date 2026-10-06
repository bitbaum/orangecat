/**
 * Group Activities API
 *
 * GET /api/groups/[slug]/activities — Fetch recent activity feed for a group.
 * RLS ensures only group members can read.
 */

import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiSuccess, apiNotFound, handleApiError } from '@/lib/api/standardResponse';
import { resolveGroupBySlug } from '@/domain/groups/helpers.server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

const MAX_LIMIT = 50;

export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { supabase } = req;
      const limit = Math.min(
        parseInt(new URL(req.url).searchParams.get('limit') || '20', 10) || 20,
        MAX_LIMIT
      );

      const group = await resolveGroupBySlug(supabase, slug);
      if (!group) {
        return apiNotFound('Group not found');
      }

      // Fetch activities (RLS restricts to members)
      const { data: activities, error } = await supabase
        .from(DATABASE_TABLES.GROUP_ACTIVITIES)
        .select('id, activity_type, metadata, created_at, user_id')
        .eq('group_id', group.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch group activities', { error, groupId: group.id }, 'Groups');
        return handleApiError(error);
      }

      if (!activities || activities.length === 0) {
        return apiSuccess({ activities: [] });
      }

      // Batch-fetch profiles for all unique user_ids
      const userIds = [
        ...new Set(activities.map((a: { user_id: string }) => a.user_id).filter(Boolean)),
      ];
      const { data: profiles } = await supabase
        .from(DATABASE_TABLES.PROFILES)
        .select('id, name, username, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(
          (p: {
            id: string;
            name: string | null;
            username: string | null;
            avatar_url: string | null;
          }) => [p.id, p]
        )
      );

      const enriched = activities.map((activity: { user_id: string; [key: string]: unknown }) => ({
        ...activity,
        user: profileMap.get(activity.user_id) ?? null,
      }));

      return apiSuccess({ activities: enriched });
    } catch (error) {
      logger.error('Activities GET error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);
