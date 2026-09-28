/**
 * The map — everything a person can do here, in their words, in one place.
 *
 * Two sources feed it and nothing else does:
 *  - the entity registry (fifteen types, each with `plain` copy), grouped by
 *    the intent each type declares;
 *  - FEATURE_CAPABILITIES below, for the handful of things that are not
 *    entities (moving money, the civic split, talking to the Cat).
 *
 * The map page, the create hub's "or browse" link, the how-it-works page and
 * the empty states all render THIS. A capability that is not on the map does
 * not exist as far as a newcomer is concerned, so the test beside this file
 * fails when a registry type is missing from it, when an intent heading has
 * nothing under it, or when copy uses a word the platform does not use.
 */
import {
  Cat,
  ArrowDownToLine,
  ArrowUpFromLine,
  HandCoins,
  Landmark,
  type LucideIcon,
} from 'lucide-react';
import { ENTITY_REGISTRY, ENTITY_TYPES, type EntityType } from '@/config/entity-registry';
import { INTENT_LIST, type Intent, type IntentId, type PlainCopy } from '@/config/intents';
import { ROUTES } from '@/config/routes';

export interface Capability extends PlainCopy {
  /** Stable id: the entity type, or a feature key. */
  id: string;
  icon: LucideIcon;
  /** Where "Start" goes. */
  startHref: string;
  /** Where "See yours" goes, when the capability produces things of yours. */
  mineHref?: string;
  /** Set for registry-backed capabilities, so a consumer can reach the type's metadata. */
  entityType?: EntityType;
}

export interface CapabilitySection {
  intent: Intent;
  capabilities: Capability[];
}

/**
 * Capabilities that are not entities. Each carries the same plain copy an
 * entity does, so a card on the map is one shape whatever it is backed by.
 */
export const FEATURE_CAPABILITIES: readonly Capability[] = [
  {
    id: 'receive',
    intent: 'money',
    icon: ArrowDownToLine,
    verb: 'Get paid by anyone',
    what: 'A link or a QR code that lands money in your wallet — from a friend, a customer, a stranger.',
    example: 'A pay link on your invoice, or a QR code by the till.',
    steps: [
      'Open your pay page',
      'Show the code or send the link',
      'It arrives in your wallet, no fee to us',
    ],
    startHref: ROUTES.RECEIVE,
  },
  {
    id: 'send',
    intent: 'money',
    icon: ArrowUpFromLine,
    verb: 'Send money to anyone',
    what: 'To a person here by name, or to any Lightning address in the world.',
    example: 'Your share of dinner, or paying the plumber.',
    steps: [
      'Pick the person or paste the address',
      'Enter the amount in your currency',
      'Confirm — it settles in seconds',
    ],
    startHref: ROUTES.SEND,
  },
  {
    id: 'request',
    intent: 'money',
    icon: HandCoins,
    verb: 'Ask someone for money',
    what: 'A request that waits until they open it, and turns into a payment when they do.',
    example: '"You owe me 30 for the tickets."',
    steps: [
      'Name the person and the amount',
      'They see it and pay in one tap',
      'Both of you see it settled',
    ],
    startHref: ROUTES.REQUESTS,
    mineHref: ROUTES.REQUESTS,
  },
  {
    id: 'civic_split',
    intent: 'money',
    icon: Landmark,
    verb: 'Say where your public money should go',
    what: 'How you would divide what you owe the public between your locality, your region and your nation — a statement, and where your voluntary giving goes.',
    example: '60% Witikon, 30% Zürich, 10% Switzerland.',
    steps: [
      'Name your three places',
      'Move three sliders',
      'See what the people of your place would choose',
    ],
    startHref: ROUTES.DASHBOARD.CIVIC_SPLIT,
    mineHref: ROUTES.DASHBOARD.CIVIC_SPLIT,
  },
  {
    id: 'cat',
    intent: 'cat',
    icon: Cat,
    verb: 'Ask your Cat to do it',
    what: 'Say what you want in a sentence; the Cat proposes the one thing, you confirm. Every action shows you a card before it happens.',
    example: '"Help me raise money for the school roof."',
    steps: ['Type or say it', 'Read the card', 'Confirm — or change it'],
    startHref: ROUTES.DASHBOARD.CAT,
  },
];

function fromEntity(type: EntityType): Capability {
  const entity = ENTITY_REGISTRY[type];
  return {
    id: type,
    entityType: type,
    icon: entity.icon,
    startHref: entity.createPath,
    mineHref: entity.basePath,
    ...entity.plain,
  };
}

/** Every capability, registry first in registry order, then features. */
export function allCapabilities(): Capability[] {
  return [...ENTITY_TYPES.map(fromEntity), ...FEATURE_CAPABILITIES];
}

/** The map: one section per intent, in intent order, each with its capabilities. */
export function buildCapabilityMap(): CapabilitySection[] {
  const all = allCapabilities();
  return INTENT_LIST.map(intent => ({
    intent,
    capabilities: all.filter(c => c.intent === intent.id),
  }));
}

/** The capabilities under one intent — for a surface that shows a single group. */
export function capabilitiesFor(intent: IntentId): Capability[] {
  return allCapabilities().filter(c => c.intent === intent);
}

export const CAPABILITY_MAP_PAGE = {
  title: 'What you can do here',
  lede: 'Everything on this page works today, for anyone, under any name, in any currency you like — settled in Bitcoin, paid to you directly. Start with a sentence, or find the thing you came for.',
} as const;
