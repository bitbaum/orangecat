/**
 * The three ways to get something built with this stack, and who the partners are.
 *
 * WHO IS A PARTNER is not a flag on a profile and not a list in this file: it
 * is membership of one organisation — the partners' guild, a public group of
 * kind `guild` at PARTNER_GUILD.slug. Admission is that group's own decision
 * (and, once the guild is bound to its Solon organization, a signed
 * membership vote there). The /partners page lists the guild's members and
 * generates each portfolio from the listings they already have. Nothing here
 * is typed twice.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';

export const PARTNER_GUILD = {
  /** The group's slug on this platform. Founding it is the first admission. */
  slug: 'bitbaum-partners',
  name: 'Bitbaum partners',
} as const;

export interface LadderRung {
  id: 'studio' | 'partner' | 'yourself';
  title: string;
  who: string;
  what: string;
  price: string;
  cta: { label: string; href: string };
}

export const LADDER: readonly LadderRung[] = [
  {
    id: 'studio',
    title: 'The studio',
    who: 'For work that has to be right the first time.',
    what: 'The studio takes the whole thing: scope, build, ship, run. A few clients at a time, by application.',
    price:
      'Priced per engagement. Everything the studio makes stays open source; it asks for appreciation, not a licence.',
    cta: { label: 'Talk to the studio', href: '/support' },
  },
  {
    id: 'partner',
    title: 'A partner',
    who: 'For a project that wants a person who has done this before.',
    what: 'Partners are independent builders admitted to the guild after a course and an assessed portfolio. You choose one from the list below and agree terms directly.',
    price: 'Their price, paid to them directly. The platform takes nothing.',
    cta: { label: 'See the partners', href: '#partners' },
  },
  {
    id: 'yourself',
    title: 'Do it yourself',
    who: 'For anyone with time and a sentence.',
    what: 'The same tools the studio and the partners use: say what you want and your Cat sets it up; Loki builds and ships it.',
    price: 'Free to start. You pay only what you choose to.',
    cta: { label: 'See what you can do', href: '/what-you-can-do' },
  },
];

export const PARTNERS_PAGE = {
  title: 'Three ways to get it built',
  lede: 'The studio, a partner, or yourself — same tools, different amount of help. Partners are the members of one guild; their portfolios are generated from what they have actually shipped here.',
  partners: {
    title: 'The partners',
    lede: 'Members of the guild, newest first. Each portfolio is the public listings on their profile — nothing is written by hand.',
    apply: 'Apply to the guild',
    empty:
      'No guild yet. The first partner founds it — a public group of kind “guild” at this address — and admission becomes its members’ decision.',
    found: 'Found the guild',
    portfolio: (n: number) => (n === 1 ? '1 public listing' : `${n} public listings`),
  },
} as const;

/** Where "apply" goes: the guild's public page, where membership is asked for. */
export function guildHref(): string {
  return `${ENTITY_REGISTRY.group.publicBasePath}/${PARTNER_GUILD.slug}`;
}

/** Where "found the guild" goes when there is none yet: the group form, pre-described. */
export function foundGuildHref(): string {
  const sentence = `${PARTNER_GUILD.name}: a guild of independent builders who ship with OrangeCat, Loki and Solon. Members are admitted by the members after a course and an assessed portfolio.`;
  return `${ENTITY_REGISTRY.group.createPath}?description=${encodeURIComponent(sentence)}&autofill=1`;
}
