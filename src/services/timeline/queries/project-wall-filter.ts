/**
 * What a project's wall shows: posts written on it (subject = the project) and
 * posts or articles whose author also put them there — a `project` row in
 * `timeline_event_visibility`, which short-post cross-posting and
 * "Also post on" for articles both write. Without the second branch those
 * cross-posts were recorded and never shown.
 */

/**
 * How many of the newest wall entries are read from the visibility table. The
 * ids travel in the query string, so the list is bounded; posts written on the
 * wall itself are matched by subject and are never cut off by it.
 */
export const PROJECT_WALL_CONTEXT_LIMIT = 100;

/**
 * One PostgREST `or` expression for the project feed: visible to this viewer
 * (public, or their own) AND on this wall (by subject, or by a wall context).
 */
export function projectWallFilter(
  projectId: string,
  wallEventIds: readonly string[],
  viewerId: string | null
): string {
  const onWall = [`and(subject_type.eq.project,subject_id.eq.${projectId})`];
  if (wallEventIds.length > 0) {
    onWall.push(`id.in.(${wallEventIds.join(',')})`);
  }
  // A logged-out viewer has no id; `actor_id.eq.null` would 400 as a bad uuid.
  const visible = viewerId
    ? `or(visibility.eq.public,actor_id.eq.${viewerId})`
    : 'visibility.eq.public';
  return `and(${visible},or(${onWall.join(',')}))`;
}
