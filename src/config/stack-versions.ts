/**
 * The stack, read from the one file that cannot be wrong about it.
 *
 * `/docs` is a PUBLIC page, and it told the world — and every coding agent that
 * reads it — that this app runs Next.js 15, TypeScript 5.8 and Tailwind CSS 3.
 * It has been on 16, 6 and 4 for some time. Measured 2026-09-17 by opening the
 * live page and diffing it against `package.json`.
 *
 * This is the same drift `.claude/CLAUDE.md` already warns about in its own
 * stack table ("this line previously claimed 3.3 long after main had moved,
 * which misled agents; keep this table honest"). That file was corrected. The
 * public page, which more people and more agents read, was not — because
 * nothing connected the claim to the fact.
 *
 * So the claim is now derived. `package.json` is the producer of what version
 * is installed; a hand-typed version string next to it is a copy, and copies
 * rot silently because nothing breaks when they do.
 *
 * Major only. A page saying "16.3.5" is noise to a reader and churns on every
 * patch bump; the honest public claim is the major line the app is on.
 */

import pkg from '../../package.json';

type Deps = Record<string, string | undefined>;

const DEPENDENCIES: Deps = {
  ...(pkg.dependencies as Deps),
  ...(pkg.devDependencies as Deps),
};

/** "^16.3.5" -> "16". Returns null when the range has no readable major. */
export function majorOf(name: string): string | null {
  const range = DEPENDENCIES[name];
  const match = range?.match(/(\d+)\./);
  return match ? match[1] : null;
}

/**
 * A version claim, or the bare product name when the version cannot be read.
 * Never invents a number: a missing dependency yields "Next.js", not "Next.js 0".
 */
export function versioned(label: string, name: string): string {
  const major = majorOf(name);
  return major ? `${label} ${major}` : label;
}

export const STACK = {
  next: versioned('Next.js', 'next'),
  typescript: versioned('TypeScript', 'typescript'),
  tailwind: versioned('Tailwind CSS', 'tailwindcss'),
  react: versioned('React', 'react'),
} as const;
