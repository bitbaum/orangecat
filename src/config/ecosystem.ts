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
const lokiOrigin = publicUrl('NEXT_PUBLIC_LOKI_URL', 'https://loki.orangecat.ch');
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
    profileUrl: orangeCatPage(publicProfilePath('catomean')),
  },
  loki: {
    title: 'Loki',
    projectId:
      process.env.NEXT_PUBLIC_LOKI_ORANGECAT_PROJECT_ID ?? '8130c927-114a-45b7-8cc2-99efd5224025',
    siteUrl: lokiOrigin.toString(),
  },
  solon: {
    title: 'Solon',
    siteUrl: solonOrigin.toString(),
  },
  support: {
    // Was orangecat@getalby.com, which 404s — the Alby account behind it no
    // longer exists, and prod does not override this env var, so the "support
    // the ecosystem" address could not be paid by anyone. Verified 2026-09-07:
    // getalby.com/.well-known/lnurlp/orangecat returns a 404 HTML page, while
    // coinos.io/.well-known/lnurlp/orangecat returns a payRequest, mints a real
    // invoice, and supports LUD-21 verify (so settlement is detectable).
    lightningAddress: process.env.NEXT_PUBLIC_ECOSYSTEM_LIGHTNING_ADDRESS ?? 'orangecat@coinos.io',
    bitcoinAddress:
      process.env.NEXT_PUBLIC_ECOSYSTEM_BITCOIN_ADDRESS ??
      'bc1q3hh4yklcmwtpnqmxyksw36yedg7zyfy6tzzqwz',
  },
} as const;

/**
 * The stack in one breath, for surfaces that introduce all three products
 * before naming any of them (/ecosystem's metadata, /support's section lead).
 * It was typed out twice, identically, so renaming a pillar meant remembering
 * both — and on 2026-09-20 one of the two would have kept calling Loki "the
 * engineering that builds it" after the other stopped.
 */
export const ECOSYSTEM_STACK_LINE =
  'the economy, the execution that gets the work done, and the governance that keeps both honest';

export const ECOSYSTEM_LINKS = {
  mao: ECOSYSTEM.orangeCat.profileUrl,
  orangeCat: orangeCatPage(`/projects/${ECOSYSTEM.orangeCat.projectId}`),
  loki: orangeCatPage(`/projects/${ECOSYSTEM.loki.projectId}`),
} as const;

export const ORANGECAT_LOKI_INTEGRATION = {
  customer: ECOSYSTEM.loki.title,
  owner: ECOSYSTEM.owner,
  orangeCat: { title: ECOSYSTEM.orangeCat.title, id: ECOSYSTEM.orangeCat.projectId },
  loki: {
    title: ECOSYSTEM.loki.title,
    id: ECOSYSTEM.loki.projectId,
    site: ECOSYSTEM.loki.siteUrl,
  },
  wallet: {
    btc: ECOSYSTEM.support.bitcoinAddress,
    lightning: ECOSYSTEM.support.lightningAddress,
  },
  relation: 'Loki is a customer of OrangeCat.',
  note: 'OrangeCat is the public funding layer; Loki is the execution layer where the work gets done.',
} as const;

export interface EcosystemPillar {
  key: 'orangecat' | 'loki' | 'solon';
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
 *   - OrangeCat → Loki: a signed, owner-approved build handoff
 *     (src/services/loki/build-intent.ts).
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
    key: 'loki',
    title: ECOSYSTEM.loki.title,
    // "Engineering" until 2026-09-20, which named the deepest capability and
    // not the product. Loki is where an operator's work actually gets done —
    // agent fleets and projects, yes, but also the people they work with, what
    // they owe, and what the day holds. Calling that "engineering" made the
    // rest read as clutter and invited a recurring proposal to move it
    // somewhere else. There is nowhere else: these surfaces exist only here.
    //
    // The axis that separates the three is not category but AUDIENCE, which is
    // what the header comment above means by different security boundaries:
    // OrangeCat is public by design, Loki is private by default, Solon is
    // shared with members.
    role: 'Execution',
    tagline: 'Get the work done — agents, projects, people, money',
    summary:
      "The execution layer: an operator's own workspace for getting work done — agent fleets and the projects they build, alongside the people, commitments and spending that the work runs on.",
    boundary:
      'Private by default, and execution stays behind an approval boundary. Funding never dispatches an agent — the owner approves each plan and each real-world action, and nothing here is published without them saying so.',
    siteUrl: ECOSYSTEM.loki.siteUrl,
    fundingUrl: ECOSYSTEM_LINKS.loki,
    fundingBody:
      'Fund Loki, supervised agent fleets, and the execution layer that turns plans into working systems.',
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
      'Shared with members, and it decides rather than executes. OrangeCat re-verifies every vote signature against its own pinned keys before a decision changes anything.',
    siteUrl: ECOSYSTEM.solon.siteUrl,
    fundingBody:
      'Back Bitcoin-signed voting and independently verifiable decisions for the whole stack.',
    icon: Landmark,
  },
];
