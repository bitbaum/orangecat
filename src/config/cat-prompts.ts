/**
 * CAT HOME — the contract for what the Cat says before you say anything.
 *
 * An empty chat is the Cat's turn, not a menu. It used to be a list of prompts
 * written in the USER's voice ("Cat, help me publish…"), led by the single most
 * consequential gap in their listings — pinned until fixed. On a real account
 * that meant the same test draft headlined the page every visit, and every
 * option was a chore. Nothing in it said the Cat knew the person.
 *
 * Now the server returns two things, both GENERATED from the user's own state
 * (src/services/cat/prompt-suggestions.ts):
 *
 *   openers — things the Cat would bring up, in the Cat's voice, ranked by how
 *             timely they are (a sale, a booking, an overdue task) before how
 *             consequential (a gap). Each carries the one or two replies that
 *             act on it. The client shows the first one the user has not
 *             dismissed, so "not now" moves the Cat on instead of freezing it.
 *   chips   — short things this person might ask, in their voice, drawn from
 *             what the Cat knows about them (goals, memories, listings).
 *
 * There is deliberately no list of prompt strings here. The single exception is
 * a user the Cat knows nothing about: zero data is zero signal, so the only
 * honest structure is a fork of intent — and even that is DERIVED from
 * ENTITY_REGISTRY, so adding an entity type never means editing prompt copy.
 */

import { getEntitiesByCategory } from '@/config/entity-registry';

export interface CatOpener {
  /**
   * Stable identity of the fact this opener is about ("draft:<id>",
   * "sales:<date>"). Dismissals are keyed on it, so a new fact — the next
   * sale — is a new key and is shown even after the last one was dismissed.
   */
  key: string;
  /** What the Cat says, first person, one or two short sentences. */
  say: string;
  /** Tap-to-send replies in the user's voice. The first is the primary action. */
  replies: string[];
}

/** One of the user's own things they can bring into a message from the "+" menu. */
export interface CatReference {
  /** Registry entity type ("product", "service"…) or "document". */
  type: string;
  id: string;
  title: string;
}

export interface CatHome {
  /** Ranked; the client shows the first not dismissed. May be empty. */
  openers: CatOpener[];
  /** Short prompts in the user's voice, at most CAT_HOME_MAX_CHIPS. */
  chips: string[];
  /**
   * What the "+" menu can attach. Rides on this payload because the server
   * already loaded exactly this state to write the openers.
   */
  attachable: CatReference[];
}

export const CAT_HOME_MAX_CHIPS = 3;

/** How many starter options a brand-new user is offered. Three is a fork; six is a menu. */
const STARTER_COUNT = 3;

/**
 * The intent fork for a user with no data, derived from the entity registry.
 * `business` is the registry's own category for the things a person offers or
 * funds, already sorted by its `createPriority`, so this tracks the registry
 * rather than restating it.
 */
export function getStarterChips(): string[] {
  return getEntitiesByCategory()
    .business.slice(0, STARTER_COUNT)
    .map(meta => `Help me create my first ${meta.name.toLowerCase()}`);
}

/**
 * What an unknown user sees — and the fallback for anonymous visitors and
 * errors. Safe as a module constant: it derives from a static registry.
 */
export const STARTER_HOME: CatHome = { openers: [], chips: getStarterChips(), attachable: [] };
