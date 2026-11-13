/**
 * Group Activities API
 *
 * GET /api/groups/[slug]/activities — Fetch recent activity feed for a group.
 *
 * The feed is for members (RLS "Group members can view activities"). Anyone
 * else who can see the group, signed in or out, gets `membersOnly: true` and
 * no rows, so the page can say the feed is for members — not "Could not load"
 * and not "No activity yet", which would be false.
 */

import { withOptionalAuth } from '@/lib/api/withAuth';
import { apiSuccess, apiNotFound, handleApiError } from '@/lib/api/standardResponse';
import { resolveGroupBySlug, checkGroupMember } from '@/domain/groups/helpers.server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { logger } from '@/utils/logger';

const MAX_LIMIT = 50;

export const GET = withOptionalAuth(
  async (req, { params }: { params: Promise<{ slug: string }> }) => {
    const { slug } = await params;
    try {
      const { supabase, user } = req;
      const limit = Math.min(
        parseInt(new URL(req.url).searchParams.get('limit') || '20', 10) || 20,
        MAX_LIMIT
      );

      const group = await resolveGroupBySlug(supabase, slug);
      if (!group) {
        return apiNotFound('Group not found');
      }

      if (!user || !(await checkGroupMember(supabase, group.id, user.id))) {
        return apiSuccess({ activities: [], membersOnly: true });
      }

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
        return apiSuccess({ activities: [], membersOnly: false });
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

      return apiSuccess({ activities: enriched, membersOnly: false });
    } catch (error) {
      logger.error('Activities GET error', { error }, 'Groups');
      return handleApiError(error);
    }
  }
);
