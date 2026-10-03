/**
 * "Throw a party" — one click, and the Cat takes care of the rest.
 *
 * A party is not a new entity type. It is an EVENT (the date, the place, the
 * page people RSVP on) plus the things a host actually has to sort out around
 * it: what is needed and who chips in, who is invited, and — only when the
 * money is shared — who decides. Every one of those is already something the
 * Cat can do; what was missing was a door that asks for all of it at once and
 * a playbook that tells the Cat how the pieces fit.
 *
 * This file is that playbook, and the only place it is written down:
 *
 *   - `PARTY.request` is the sentence one click hands to the Cat
 *     (`partyCatHref()` → `/dashboard/cat?q=…`, auto-sent).
 *   - `PARTY_STEPS` is what the Cat takes care of, in order. Each step names
 *     the Cat action that does it, and `party.test.ts` fails if an action id
 *     here stops existing in CAT_ACTIONS — the playbook cannot promise a step
 *     the Cat has no way to take.
 *   - `partyPlaybook()` renders both into the Cat's system prompt.
 *
 * The neighbours, honestly. Loki and Solon appear only where their own repos
 * say they can help (src/config/neighbour-capabilities.ts):
 *   - Loki builds a real site — offered only if the host wants a party page of
 *     its own beyond the event page, never by default.
 *   - Solon is for an organisation that decides by signed vote (a Verein, a
 *     co-op). A group of friends splitting drinks decides in its own group on
 *     OrangeCat; Solon would be absurd there, and the Cat must not suggest it.
 */

import { ROUTES } from '@/config/routes';
import { CAT_QUERY_PARAM } from '@/config/cat-door';

export const PARTY = {
  /** The one-click label, everywhere it appears. */
  label: 'Throw a party',
  /** One line under the label: what the click does. */
  description: 'One click — your Cat asks a few things and sets it all up',
  /**
   * What the click says to the Cat, in the host's voice. Short on purpose: the
   * playbook below carries the how; this only has to start it.
   */
  request: 'I want to throw a party. Ask me what you need, then take care of everything.',
} as const;

/**
 * The few things only the host knows. The Cat asks these together, in ONE
 * message, and assumes sensible defaults for anything left unanswered rather
 * than asking twice.
 */
export const PARTY_QUESTIONS = [
  'What is it for, and when (date and rough time)?',
  'Where — a place, or should it stay open for now?',
  'Roughly how many people, and who (OrangeCat usernames are enough)?',
  'Who pays: you, guests chipping in for what is needed, or a group you share money with?',
] as const;

export interface PartyStep {
  /** What the host gets, in their words. */
  title: string;
  /** How the Cat does it, and when it applies. */
  how: string;
  /** The Cat action that performs this step. Guarded against CAT_ACTIONS. */
  action: string;
  /** Only done when the condition in `how` holds; never by default. */
  conditional?: boolean;
}

export const PARTY_STEPS: readonly PartyStep[] = [
  {
    title: 'The party page',
    how: 'Create an event with event_type "party", the date, the place, and is_free true unless the host sells tickets. Keep it a draft until the host says publish.',
    action: 'create_event',
  },
  {
    title: 'What is needed, and who chips in',
    how: 'A wishlist dated to the party (drinks, food, music, decorations — whatever the host names) so guests fund the actual things instead of passing a hat. Skip it if the host pays for everything.',
    action: 'create_wishlist',
  },
  {
    title: 'The invitations',
    how: 'Message each named OrangeCat guest with the party page. For anyone not on OrangeCat, hand the host the page link to share.',
    action: 'send_message',
  },
  {
    title: 'A nudge before the day',
    how: 'A reminder for the host the day before: confirm numbers, check the wishlist, publish if still a draft.',
    action: 'set_reminder',
  },
  {
    title: 'Shared money, decided together',
    how: 'ONLY when the party is paid from a group the host belongs to: put the spend to that group as a treasury proposal, so members decide rather than one person spending everyone’s money. If the group governs with Solon (a Verein, a co-op), give the prefilled Solon link from the result instead of voting here.',
    action: 'propose_to_group',
    conditional: true,
  },
  {
    title: 'A site of its own',
    how: 'ONLY if the host asks for more than the event page (a custom site for a wedding or a festival): Loki builds and deploys one. Say a build was started, never that it is ready.',
    action: 'build_site',
    conditional: true,
  },
];

/** The `## ` heading of the playbook in the Cat's brief — one spelling for every list that names it. */
export const PARTY_SECTION_HEADING = 'Throwing a Party';

/**
 * When a turn is plausibly about a party, so the playbook is sent. Generous on
 * purpose (a false include costs a few hundred characters), and multilingual
 * because the hosts are: Swiss German, French, Italian, Russian.
 */
export const PARTY_TRIGGER =
  /\bpart(y|ies)\b|throw a|birthday|housewarming|celebrat|get-?together|wedding|barbecue|\bbbq\b|anniversary|fest\b|feier|\bfête|\bfesta\b|вечеринк|праздн|день рождения/;

/** The one-click link: opens the Cat with the request already sent. */
export function partyCatHref(): string {
  return `${ROUTES.DASHBOARD.CAT}?${CAT_QUERY_PARAM}=${encodeURIComponent(PARTY.request)}`;
}

/** The block the Cat's system prompt carries. Built from the data above, never restated. */
export function partyPlaybook(): string {
  const questions = PARTY_QUESTIONS.map(q => `- ${q}`).join('\n');
  const steps = PARTY_STEPS.map(
    (s, i) => `${i + 1}. **${s.title}** (\`${s.action}\`) — ${s.how}`
  ).join('\n');
  return `## ${PARTY_SECTION_HEADING}
When someone wants to throw a party (a birthday, a housewarming, a team night, "${PARTY.request}"), you take care of it end to end. Do not hand them a checklist to do themselves — do the steps.

First, ask everything you need in ONE message, then stop asking:
${questions}

Then say the whole plan in a few lines and carry it out, step by step. Steps that need their okay reach them as confirmation cards — say so, and never describe a step as done before its result is in:
${steps}

Rules:
- Unanswered means a sensible default (free entry, location to be announced, a draft page), stated in one line — never a second round of questions.
- The conditional steps happen only when their condition holds. Most parties need neither a group vote nor Loki; do not mention them otherwise.
- Never invent guests, prices or a venue. Never publish or message anyone before they confirm.`;
}
