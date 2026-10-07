/**
 * "What it solves" — the homepage's answer to "what is this actually for?"
 *
 * Each entry is a concrete situation a real person or community is in, then
 * what happens on OrangeCat, then the ONE entity type that does it. The type is
 * the link: its name, icon, verb and create path all come from
 * ENTITY_REGISTRY, so the card can never point at a feature that does not
 * exist or describe it in words the rest of the product does not use.
 *
 * Honesty rule: every `solution` describes something that works today. A
 * roadmap item (other payment rails, E2E messaging) does not belong here.
 */

import type { EntityType } from '@/config/entity-registry';

export interface ProblemWeSolve {
  id: string;
  /** The situation, in the words of the person in it. */
  problem: string;
  /** What happens here — who does what, where the money goes. */
  solution: string;
  /** The entity type that does it. Drives the icon, the verb and the link. */
  entityType: EntityType;
}

export interface ProblemScale {
  id: 'people' | 'society';
  title: string;
  subtitle: string;
  items: readonly ProblemWeSolve[];
}

export const PROBLEMS_SECTION = {
  title: 'What it solves',
  subtitle:
    'Real problems, small and large. In each one your Cat does the setup, people pay each other directly in Bitcoin, and nobody in the middle takes a cut or can freeze the money.',
} as const;

export const PROBLEM_SCALES: readonly ProblemScale[] = [
  {
    id: 'people',
    title: 'For you',
    subtitle: 'The problems a single person runs into this month.',
    items: [
      {
        id: 'skills-no-income',
        problem: '“I can do something useful, but I don’t know how to get paid for it.”',
        solution:
          'Tell your Cat what you can do. It writes the service page, sets a price and gives you one link to share. Clients pay you directly, from anywhere.',
        entityType: 'service',
      },
      {
        id: 'short-month',
        problem: '“I need 500 to get through the month, and the bank says no.”',
        solution:
          'Borrow from people who know you, on terms you both agree: how much, how long, how it is repaid. The terms are written down where you both can see them.',
        entityType: 'loan',
      },
      {
        id: 'specific-need',
        problem: '“My kid needs a laptop for school, and asking for money feels wrong.”',
        solution:
          'List the exact things you need and share the link. Someone buys one, and you see it arrive. Nobody has to wonder where the money went.',
        entityType: 'wishlist',
      },
      {
        id: 'idle-things',
        problem: '“I own things that sit unused most of the week.”',
        solution:
          'A spare room, a camera or a car can earn rent, or back a loan. Your Cat lists it, so people nearby can find it and pay to use it.',
        entityType: 'asset',
      },
      {
        id: 'shared-purse',
        problem: '“Four of us are saving together, and someone always ends up holding the money.”',
        solution:
          'Make a circle with a shared purse. Everyone can see what went in and what went out, so nobody has to keep the tally.',
        entityType: 'circle',
      },
      {
        id: 'locked-out',
        problem: '“I have no bank account, or no papers, or my account was frozen.”',
        solution:
          'Use any name. Connect a wallet you control, and money lands there directly. It never sits with us, so there is nothing for anyone to freeze.',
        entityType: 'wallet',
      },
    ],
  },
  {
    id: 'society',
    title: 'For everyone',
    subtitle: 'The problems a street, a town or a field has, and nobody owns.',
    items: [
      {
        id: 'public-goods',
        problem: 'Work everyone relies on, and nobody pays for.',
        solution:
          'An open-source library, a soup kitchen or a community garden gets ongoing support straight from the people who rely on it. All of it reaches the recipient.',
        entityType: 'cause',
      },
      {
        id: 'local-outcome',
        problem:
          'A school roof, a village well. Everyone agrees it’s needed, and nobody has the money.',
        solution:
          'Set a target and milestones that backers can hold you to. Money arrives as people give, and you report on each milestone in public.',
        entityType: 'project',
      },
      {
        id: 'unasked-questions',
        problem: 'Questions nobody is paid to answer.',
        solution:
          'Soil health in your valley, or the off-label use of a cheap drug. The people who want the answer pay for the research, and the findings are published openly.',
        entityType: 'research',
      },
      {
        id: 'small-capital',
        problem: 'Small businesses can’t get capital, and neighbours can’t invest in them.',
        solution:
          'A bakery raises money for a second oven in exchange for 5% of profits, from the people who buy its bread. No bank and no fund in between.',
        entityType: 'investment',
      },
      {
        id: 'shared-decisions',
        problem: 'Groups argue over shared money, and nobody trusts how the decision was made.',
        solution:
          'A Verein, co-op or neighbourhood fund keeps a shared treasury and its members decide together how it is spent, and by which rules.',
        entityType: 'group',
      },
      {
        id: 'bring-people-together',
        problem: 'Repair cafés and meetups fold because nobody covers the costs.',
        solution:
          'Set a date and a place, free or ticketed. The tickets cover the costs before anyone arrives, so the organiser isn’t left paying the difference.',
        entityType: 'event',
      },
    ],
  },
] as const;
