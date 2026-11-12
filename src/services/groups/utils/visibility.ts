/**
 * Who may see a group's content. One rule, read by the group page, the
 * service reads and the permission check. The row policies in migration
 * 20261112235900 hold the same rule in SQL.
 *
 * A group's name and label are its listing. Everything else (members,
 * wallets, events, proposals, activity, the pay card) is content. Content is
 * open to someone outside the group only when the group is listed
 * (`is_public`) AND its visibility is 'public'. A "Members only" or "Private"
 * group shows its content to its members alone, and an unknown visibility
 * counts as closed (and the column is NOT NULL since 20261112235900).
 *
 * Known gap: the `groups` row of a listed group is still readable over REST
 * by anyone, all columns (description, tags, created_by, bitcoin_address,
 * lightning_address). The page shows an outsider only the name and label,
 * but the data layer does not hide the rest yet.
 */

interface GroupVisibilityFields {
  is_public?: boolean | null;
  visibility?: string | null;
}

export function groupContentIsOpen(group: GroupVisibilityFields): boolean {
  return group.is_public === true && group.visibility === 'public';
}

export function canSeeGroupContent(group: GroupVisibilityFields, isMember: boolean): boolean {
  return isMember || groupContentIsOpen(group);
}
