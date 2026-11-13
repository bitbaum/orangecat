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
 *   today   — what needs the person, as at most three ACTIONS, each with the
 *             one link that does it, and a link to their day in Loki (Loki
 *             owns the day). Never a count: "read it and tap once" is the
 *             owner's test (services/cat/today-lines.ts).
 *   openers — things the Cat would bring up, in the Cat's voice: a sale, a
 *             goal, a gap in their listings. Each carries the one or two
 *             replies that act on it. The client shows the first one the user
 *             has not dismissed, and only when nothing needs them today.
 *   chips   — short things this person might ask, in their voice: the
 *             openers' replies in an order that turns with the calendar day,
 *             so the same three are not offered every morning.
 *
 * There is deliberately no list of prompt strings here. The single exception is
 * a user the Cat knows nothing about: zero data is zero signal, so they are
 * offered the door's own examples (DOOR_EXAMPLES) — whole sentences of things
 * it can do today. They used to be registry nouns ("Help me create my first
 * product"), which told a new person the names of tables, not what to say.
 */

import { DOOR_EXAMPLES } from '@/config/cat-door';

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
  /** What needs them today. Null for a person the Cat knows nothing about. */
  today: CatToday | null;
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

export type DayPart = 'morning' | 'afternoon' | 'evening';

/**
 * Which part of the day an hour (0–23, the person's wall clock) belongs to.
 * One rule for the greeting and the day brief, so "Good morning" is never
 * followed by an evening reply. The small hours count as the evening before.
 */
export function dayPartFor(hour: number): DayPart {
  if (hour < 5) {
    return 'evening';
  }
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

/** The link to the person's day in Loki, by part of day. Says where it goes. */
export const DAY_LINK_LABELS: Record<DayPart, string> = {
  morning: 'Start my day in Loki',
  afternoon: 'My day in Loki',
  evening: 'Wrap up my day in Loki',
};

/** Lines of "today" the home shows: what fits above the composer on a phone. */
export const CAT_TODAY_MAX_LINES = 3;

/** One thing that needs the person, and the one link that acts on it. */
export interface CatTodayLine {
  /** Stable identity ("task:<id>", "loki:approval:<id>"). */
  key: string;
  /** Written as the action: "Reply to Ben", "Send invoice — due 1 Nov". */
  text: string;
  /** The one tap: an OrangeCat path, or an absolute Loki URL. */
  href: string;
  /** Something broken or exposed: shown first, and marked. */
  urgent?: boolean;
}

export interface CatToday {
  /** At most CAT_TODAY_MAX_LINES, most pressing first. Empty: nothing needs them. */
  lines: CatTodayLine[];
  /** Their day in Loki, when they use Loki. */
  day: { label: string; href: string } | null;
}

/** How many starter options a brand-new user is offered. Three is a fork; six is a menu. */
const STARTER_COUNT = 3;

/**
 * What a user with no data is offered: the first of the door's examples, the
 * same sentences the "What do you want to do?" box shows, so the two first
 * screens speak with one voice.
 */
export function getStarterChips(): string[] {
  return DOOR_EXAMPLES.slice(0, STARTER_COUNT);
}

/**
 * What an unknown user sees — and the fallback for anonymous visitors and
 * errors. Safe as a module constant: it derives from static config.
 */
export const STARTER_HOME: CatHome = {
  today: null,
  openers: [],
  chips: getStarterChips(),
  attachable: [],
};
