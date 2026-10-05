/**
 * Cat playbooks — how the Cat carries out a whole goal, not a single action.
 *
 * A person does not arrive wanting "an event entity". They arrive wanting a
 * birthday, a meetup, a conference. Each of those is several things the Cat
 * can already do — a page, a wishlist, invitations, a booking, a reminder —
 * and the Cat needs to know which, in what order, and when to stop. That is
 * a playbook, and this file is the only place they are written.
 *
 * Deliberately NOT a menu. The Cat is the interface: a playbook is knowledge
 * the Cat carries into a conversation, selected when the person's own words
 * match `trigger`, never a list of occasions anyone has to browse. Few and
 * broad on purpose — one "hold an event" that sizes itself from a dinner for
 * eight to a two-day conference, rather than a playbook per occasion.
 *
 * Each playbook renders into the Cat's brief as one SITUATIONAL `## ` section
 * (cat-prompt-sections.ts), so it costs nothing on a turn about something
 * else. `cat-playbooks.test.ts` fails if a step names an action the Cat does
 * not have, or if a playbook's own example stops loading it.
 *
 * Neighbours appear only where their own repos say they can help
 * (neighbour-capabilities.ts): Loki builds a site when someone asks for one;
 * Solon holds a decision for a group that already governs there. Most
 * goals need neither, and the steps that use them are `conditional`.
 */

import { MAX_ACTION_STEPS } from '@/services/cat/action-loop';

export interface PlaybookStep {
  /** What the person gets, in their words. */
  title: string;
  /** How the Cat does it, and when it applies. */
  how: string;
  /** The Cat action that performs this step. Guarded against CAT_ACTIONS. */
  action: string;
  /** Only done when the condition in `how` holds — never by default. */
  conditional?: boolean;
}

export interface Playbook {
  id: string;
  /** The `## ` heading in the Cat's brief; one spelling for every list that names it. */
  heading: string;
  /** When a turn is plausibly about this. Generous: a false include costs a few hundred characters. */
  trigger: RegExp;
  /** Sentences a person would actually say. Each must load the playbook (tested). */
  examples: readonly string[];
  /** The few things only the person knows, asked together in ONE message. */
  questions: readonly string[];
  /** How the plan grows or shrinks with what they are doing. */
  sizing: string;
  steps: readonly PlaybookStep[];
}

export const HOLD_AN_EVENT: Playbook = {
  id: 'hold_an_event',
  heading: 'Holding an Event (party to conference)',
  trigger:
    /\bpart(y|ies)\b|throw a|birthday|housewarming|celebrat|get-?together|wedding|barbecue|\bbbq\b|anniversary|\bevents?\b|conference|meetup|meet-up|workshop|festival|concert|gathering|retreat|hackathon|dinner for|fest\b|feier|anlass|\bfête|soirée|\bfesta\b|вечеринк|праздн|день рождения|конференц|встреч/,
  examples: [
    'I want to throw a party on Saturday',
    'Help me organise a meetup next month',
    'We are running a two-day conference in Basel',
    'Хочу устроить вечеринку',
  ],
  questions: [
    'What is it, and when (date and rough time)?',
    'Where — a place, or still open?',
    'Roughly how many people, and is it private (invited) or public (anyone can come)?',
    'Who pays: free, tickets, people chipping in for what is needed, or money a group shares?',
  ],
  sizing:
    'A private party for fifteen is the page, a wishlist, the invitations and a reminder. A public meetup adds getting the word out. A conference adds tickets, bookings and backers for the costs up front. Never add a step the event does not need.',
  steps: [
    {
      title: 'The event page',
      how: 'create_event with the event_type that fits (party, meetup, conference, workshop, festival…), the date, the place, and either is_free or ticket_price_btc. A draft until they say publish.',
      action: 'create_event',
    },
    {
      title: 'What is needed, and who chips in',
      how: 'A wishlist dated to the event for the things it needs (drinks, food, gear, the venue deposit) so people fund the actual things. Skip it when the host covers everything or tickets do.',
      action: 'create_wishlist',
    },
    {
      title: 'The people who make it happen',
      how: 'For a venue, catering, a DJ or a photographer: find services on OrangeCat with search_platform, name the best one or two, and book the one they choose. Never book before they choose.',
      action: 'book_service',
      conditional: true,
    },
    {
      title: 'The invitations',
      how: 'Message each named OrangeCat guest or speaker with the event page. For anyone not on OrangeCat, hand them the page link to share.',
      action: 'send_message',
    },
    {
      title: 'Getting the word out',
      how: 'ONLY for a public event: draft its announcement for the channels they use. Never for a private party.',
      action: 'draft_promotion',
      conditional: true,
    },
    {
      title: 'A nudge before the day',
      how: 'A reminder for the host before the event: confirm numbers, check the wishlist, publish if still a draft. A week ahead for a conference, the day before for a party.',
      action: 'set_reminder',
    },
    {
      title: 'Shared money, decided together',
      how: 'ONLY when a group the host belongs to pays from money it shares: put the spend to that group as a proposal so the members decide. If the group governs with Solon (a Verein, a co-op), use decide_on "solon" and give them the prefilled link.',
      action: 'propose_to_group',
      conditional: true,
    },
    {
      title: 'A site of its own',
      how: 'ONLY if they ask for more than the event page (a conference programme, a wedding site): Loki builds and deploys one. Say a build was started, never that it is ready.',
      action: 'build_site',
      conditional: true,
    },
  ],
};

/** Every playbook the Cat carries. Add one here; nothing else restates the list. */
export const CAT_PLAYBOOKS: readonly Playbook[] = [HOLD_AN_EVENT];

/** The section the Cat's brief carries for one playbook. Built from the data, never restated. */
export function playbookSection(p: Playbook): string {
  const questions = p.questions.map(q => `- ${q}`).join('\n');
  const steps = p.steps
    .map((s, i) => `${i + 1}. **${s.title}** (\`${s.action}\`) — ${s.how}`)
    .join('\n');
  return `## ${p.heading}
When someone wants this ("${p.examples[0]}"), you carry it out end to end. Do the steps; never hand them a checklist to do themselves.

First, ask everything you need in ONE message, then stop asking:
${questions}

Size the plan: ${p.sizing}

The steps, in order:
${steps}

Rules:
- Unanswered means a sensible default (free entry, place to be announced, a draft page), stated in one line — never a second round of questions.
- At most ${MAX_ACTION_STEPS} actions in one reply: lead with the page and the money, and offer the rest in your next message.
- Steps that need their okay reach them as confirmation cards; say so, and never call a step done before its result is in.
- Conditional steps happen only when their condition holds. Most events need neither a group vote nor Loki; do not mention them otherwise.
- Never invent guests, prices, a venue or a booking. Never publish or message anyone before they confirm.`;
}

/** All playbook sections, in the order above, for the Cat's brief. */
export function playbookSections(): string {
  return CAT_PLAYBOOKS.map(playbookSection).join('\n\n');
}

export const PLAYBOOK_HEADINGS: readonly string[] = CAT_PLAYBOOKS.map(p => p.heading);
