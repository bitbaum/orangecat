/**
 * Who may join a group by themselves, without an invitation. The group page
 * reads it to decide whether to offer "Join"; the database function
 * join_public_group (migration 20261112201000) holds the same rule in SQL and
 * is what actually decides.
 *
 * A group is open to join when it is listed (`is_public`) AND its visibility
 * is 'public'. "Members only", "Private" and unlisted groups take members by
 * invitation, and an unknown visibility counts as closed.
 */

interface GroupJoinFields {
  is_public?: boolean | null;
  visibility?: string | null;
}

export function groupIsOpenToJoin(group: GroupJoinFields): boolean {
  return group.is_public === true && group.visibility === 'public';
}
