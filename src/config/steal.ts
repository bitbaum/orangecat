/**
 * "Steal the cat" — the open-source campaign, defined once.
 *
 * Everything the /steal page and its QR code say comes from here. The point
 * of the campaign is releasing technology: someone scans a poster and can
 * either use OrangeCat as it is, or take the code, change it and own their
 * copy outright. MIT means that second path needs nobody's permission, so the
 * page must never put a form, a call or an approval in front of it.
 */

import { APP_NAME, SITE_URL } from './brand';
import { ECOSYSTEM } from './ecosystem';
import { ROUTES } from './routes';

export const STEAL_ORG_URL = 'https://github.com/bitbaum';

export interface StealableRepo {
  /** GitHub repo name under STEAL_ORG_URL. */
  repo: string;
  name: string;
  /** What you walk away with, in one line. */
  what: string;
  /** What it needs to run, so nobody discovers it halfway through. */
  needs: string;
}

/** The cat itself. Kept apart from the rest so the page can lead with it. */
export const STEAL_THE_CAT: StealableRepo = {
  repo: 'orangecat',
  name: APP_NAME,
  what: 'An AI economic agent and the platform it runs on: Bitcoin payments, funding, loans, groups.',
  needs: 'Node 24, pnpm and a Supabase project',
};

/** The rest of the fleet. Every one is public and MIT. */
export const STEALABLE_REPOS: readonly StealableRepo[] = [
  {
    repo: 'loki',
    name: 'Loki',
    what: 'A command centre for building with AI agent fleets.',
    needs: 'Postgres with pgvector and a GitHub OAuth app',
  },
  {
    repo: 'solon',
    name: 'Solon',
    what: 'Governance for any group: proposals, signed votes, an append-only audit trail.',
    needs: 'Postgres',
  },
  {
    repo: 'evig',
    name: 'evig',
    what: 'A storefront, marketplace and repair network for durable hardware.',
    needs: 'Postgres (Docker is enough)',
  },
  {
    repo: 'substrata',
    name: 'Substrata',
    what: 'An open research site and engine for physical chokepoints in technology.',
    needs: 'Nothing to start',
  },
  {
    repo: 'heidi',
    name: 'Heidi',
    what: 'A speaking-first tutor for Zurich German.',
    needs: 'Postgres',
  },
];

export const repoUrl = (repo: string) => `${STEAL_ORG_URL}/${repo}`;
export const forkUrl = (repo: string) => `${repoUrl(repo)}/fork`;
/**
 * Loki's "Make it yours": agents import the repo into a project of the
 * person's own and rename it for them, for people who would rather not fork
 * and set up by hand. Loki's allowlist (loki src/config/open-source-starters.ts)
 * holds the same repos.
 */
export const makeItYoursUrl = (repo: string) =>
  `${new URL('/take', ECOSYSTEM.loki.siteUrl).toString()}?repo=${encodeURIComponent(repo)}`;
/** A clean copy with none of our git history: the copy starts as yours. */
export const cloneCommand = (repo: string) => `npx degit bitbaum/${repo} my-${repo}`;

/** What the poster's QR code opens. `?from=qr` only tells a scan apart from a visit; it identifies nobody. */
export const STEAL_QR_TARGET = `${SITE_URL}${ROUTES.STEAL}?from=qr`;
/** File name of the poster QR code when someone downloads it. */
export const STEAL_QR_FILENAME = 'steal-the-cat-qr.svg';

/** The three steps from "I like it" to "it's mine". */
export const STEAL_STEPS = [
  {
    title: 'Take it',
    body: 'Fork it on GitHub, or run the one-line copy below. You need no account with us.',
  },
  {
    title: 'Change it',
    body: `Rename it, recolour it, rewrite it. The name and colours start in src/config/brand.ts.`,
  },
  {
    title: 'Own it',
    body: 'Run it on your own server under your own name. Keep the LICENSE file. That is the only condition.',
  },
] as const;

/**
 * What we look for in the people who take it further. Copying is free; the
 * skill that stays scarce once agents and robots write most of the code is
 * seeing the whole system.
 */
export const SYSTEMS_THINKING_PROMPTS = [
  {
    title: 'Find the second source of truth',
    body: 'Find a fact this code defines in two places. Show how the copies will drift, and say where the one copy should live.',
  },
  {
    title: 'Find the silent failure',
    body: 'Pick a promise (a payment lands, a vote counts, a deploy goes live). Find where it fails while every check stays green, and propose the check that would catch it.',
  },
  {
    title: 'Find where the human belongs',
    body: 'Point to a step where an agent acts alone but a person should decide, or the reverse, and say why.',
  },
] as const;
