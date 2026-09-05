import { Bot, Cat, Landmark } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import { publicProfilePath } from './public-profile-path';
import { SOLON_BASE_URL_DEFAULT } from './solon';

const DEFAULT_ORANGECAT_ORIGIN = 'https://www.orangecat.ch';

function publicUrl(name: string, fallback: string): URL {
  const value = process.env[name] ?? fallback;
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
}

const orangeCatOrigin = publicUrl('NEXT_PUBLIC_ORANGECAT_URL', DEFAULT_ORANGECAT_ORIGIN);
const fleetCrownOrigin = publicUrl('NEXT_PUBLIC_FLEETCROWN_URL', 'https://fleetcrown.orangecat.ch');
const solonOrigin = publicUrl('NEXT_PUBLIC_SOLON_URL', SOLON_BASE_URL_DEFAULT);

function orangeCatPage(path: string): string {
  return new URL(path, orangeCatOrigin).toString();
}

/** Canonical public identities used by support and sibling-product surfaces. */
export const ECOSYSTEM = {
  owner: 'Cato',
  orangeCat: {
    title: 'OrangeCat',
    projectId:
      process.env.NEXT_PUBLIC_ORANGECAT_PROJECT_ID ?? 'cb093f00-8745-4579-98df-050ebfb37181',
    siteUrl: orangeCatOrigin.toString(),
    profileUrl: orangeCatPage(publicProfilePath('mao-nakamoto')),
  },
  fleetCrown: {
    title: 'FleetCrown',
    projectId:
      process.env.NEXT_PUBLIC_FLEETCROWN_ORANGECAT_PROJECT_ID ??
      '8130c927-114a-45b7-8cc2-99efd5224025',
    siteUrl: fleetCrownOrigin.toString(),
  },
  solon: {
    title: 'Solon',
    siteUrl: solonOrigin.toString(),
  },
  support: {
    lightningAddress:
      process.env.NEXT_PUBLIC_ECOSYSTEM_LIGHTNING_ADDRESS ?? 'orangecat@getalby.com',
    bitcoinAddress:
      process.env.NEXT_PUBLIC_ECOSYSTEM_BITCOIN_ADDRESS ??
      'bc1q3hh4yklcmwtpnqmxyksw36yedg7zyfy6tzzqwz',
  },
} as const;

export const ECOSYSTEM_LINKS = {
  mao: ECOSYSTEM.orangeCat.profileUrl,
  orangeCat: orangeCatPage(`/projects/${ECOSYSTEM.orangeCat.projectId}`),
  fleetCrown: orangeCatPage(`/projects/${ECOSYSTEM.fleetCrown.projectId}`),
} as const;

export const ORANGECAT_FLEETCROWN_INTEGRATION = {
  customer: ECOSYSTEM.fleetCrown.title,
  owner: ECOSYSTEM.owner,
  orangeCat: { title: ECOSYSTEM.orangeCat.title, id: ECOSYSTEM.orangeCat.projectId },
  fleetCrown: {
    title: ECOSYSTEM.fleetCrown.title,
    id: ECOSYSTEM.fleetCrown.projectId,
    site: ECOSYSTEM.fleetCrown.siteUrl,
  },
  wallet: {
    btc: ECOSYSTEM.support.bitcoinAddress,
    lightning: ECOSYSTEM.support.lightningAddress,
  },
  relation: 'FleetCrown is a customer of OrangeCat.',
  note: 'OrangeCat is the public funding layer; FleetCrown is the building layer.',
} as const;

export interface EcosystemPillar {
  key: 'orangecat' | 'fleetcrown' | 'solon';
  /** Product name. */
  title: string;
  /** The one word that makes this pillar different from the other two. */
  role: string;
  /** Half-line for dense surfaces (nav dropdowns, menus). */
  tagline: string;
  /** What this pillar is, in one sentence, for a first-time reader. */
  summary: string;
  /** Why it is a separate product — the boundary it owns. */
  boundary: string;
  /** The product's own home. */
  siteUrl: string;
  /** Where it can be backed on OrangeCat, when it has a public page. */
  fundingUrl?: string;
  /** What backing this pillar pays for. */
  fundingBody: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** True for the pillar this codebase *is* — surfaces link inward, not out. */
  isSelf?: boolean;
}

/**
 * The three-pillar stack, and the SSOT for every surface that presents it
 * (/ecosystem, /support, the footer). One stack, three products: they stay
 * separate because public economic coordination, agent execution, and
 * rule-making have different security boundaries — and they are bound by
 * real seams, not by a diagram:
 *
 *   - OrangeCat → FleetCrown: a signed, owner-approved build handoff
 *     (src/services/fleetcrown/build-intent.ts).
 *   - Solon → OrangeCat: the platform allocation policy changes only via a
 *     Bitcoin-signed Solon vote whose decision document OrangeCat re-verifies
 *     locally against its own pinned keys
 *     (src/services/solon/decision-verify.ts) — a Solon decision is evidence,
 *     not authority.
 */
export const ECOSYSTEM_PILLARS: readonly EcosystemPillar[] = [
  {
    key: 'orangecat',
    title: ECOSYSTEM.orangeCat.title,
    role: 'Economy',
    tagline: 'Fund, offer, and get paid in Bitcoin',
    summary:
      'The public economic layer: where a person, project, group, product, or service is explained, shared, supported, offered, or joined — and paid in Bitcoin.',
    boundary:
      'Public by design. Everything here is a page someone can read, share, and settle against without an account.',
    siteUrl: ECOSYSTEM.orangeCat.siteUrl,
    fundingUrl: ECOSYSTEM_LINKS.orangeCat,
    fundingBody:
      'Fund the public economic layer for people, projects, groups, products, and services.',
    icon: Cat,
    isSelf: true,
  },
  {
    key: 'fleetcrown',
    title: ECOSYSTEM.fleetCrown.title,
    role: 'Engineering',
    tagline: 'Build with Loki and supervised agent fleets',
    summary:
      'The production layer: where Loki plans the work and supervised agent fleets help turn a funded intention into a working system.',
    boundary:
      'Execution stays behind an approval boundary. Funding never dispatches an agent — the owner approves each plan and each real-world action.',
    siteUrl: ECOSYSTEM.fleetCrown.siteUrl,
    fundingUrl: ECOSYSTEM_LINKS.fleetCrown,
    fundingBody:
      'Fund Loki, supervised agent fleets, and the production layer that turns plans into working systems.',
    icon: Bot,
  },
  {
    key: 'solon',
    title: ECOSYSTEM.solon.title,
    role: 'Governance',
    tagline: 'Bitcoin-signed governance — where the stack decides',
    summary:
      'The governance layer: where platform-level rules are proposed, voted on with Bitcoin-signed messages, and published as decision documents anyone can re-verify.',
    boundary:
      'It decides, it does not execute. OrangeCat re-verifies every vote signature against its own pinned keys before a decision changes anything.',
    siteUrl: ECOSYSTEM.solon.siteUrl,
    fundingBody:
      'Back Bitcoin-signed voting and independently verifiable decisions for the whole stack.',
    icon: Landmark,
  },
];
