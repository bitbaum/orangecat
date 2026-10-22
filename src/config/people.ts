/**
 * Finding a person to pay or to ask — SSOT for the list under "To" / "From".
 *
 * The platform's public search lists a profile only once it has said
 * something about itself (a bio, a picture, a name of its own), which is
 * right for Discover and wrong for money: the friend who signed up this
 * morning with nothing but a handle is exactly who you want to pay. So the
 * money screens have their own finder. It starts from YOUR circle — the
 * people you follow, who follow you, and whoever you have asked or been
 * asked by — and only then the rest of OrangeCat.
 */

export const PERSON_RELATIONS = ['mutual', 'following', 'follower', 'requested', 'none'] as const;
export type PersonRelation = (typeof PERSON_RELATIONS)[number];

/** Higher sorts first; the one tie-break the ranker applies after the text. */
export const PERSON_RELATION_WEIGHT: Record<PersonRelation, number> = {
  mutual: 4,
  following: 3,
  follower: 2,
  requested: 1,
  none: 0,
};

/** Rows the finder returns; the list shows at most PEOPLE_LIST_ROWS of them. */
export const PEOPLE_FIND_LIMIT = 8;
export const PEOPLE_LIST_ROWS = 5;

export const PEOPLE_COPY = {
  listLabel: 'People',
  /** The word on the right of a row — why this person is here. Nothing for a stranger. */
  relation: {
    mutual: 'Follow each other',
    following: 'Following',
    follower: 'Follows you',
    requested: 'Recent',
    none: '',
  } satisfies Record<PersonRelation, string>,
} as const;
