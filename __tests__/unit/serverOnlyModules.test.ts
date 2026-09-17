/**
 * `.server.ts` must actually stay on the server.
 *
 * The suffix is a convention, and conventions don't fail builds. The stakes are
 * concrete: `services/currency/rateSource.server.ts` reaches a third party and
 * kicks off a refresh the moment it loads. Bundled into a client chunk it ships
 * an outbound CoinGecko call to every visitor — a CSP violation, a privacy
 * leak, and one upstream request per person instead of one per minute for the
 * whole platform. Browsers get rates from our own /api/rates instead.
 *
 * This checked only whether a `'use client'` file imported a `.server` module
 * DIRECTLY, and that is not how bundling works. Anything a client component
 * reaches, through however many hops, is compiled into the client bundle — and
 * the intermediate files carry no directive to give the game away.
 *
 * It shipped. Measured in production 2026-08-28: the browser fetched
 * `https://api.coingecko.com/api/v3/simple/price` directly on page load, 534ms
 * in the critical path, and `api.coingecko.com` was present in a client chunk
 * on disk. The chain was three hops and every file after the first looked
 * innocent:
 *
 *   dashboard/bookings/page.tsx  'use client'
 *     → services/bookings/index.ts        (no directive)
 *       → services/currency/rates.server.ts
 *         → services/currency/rateSource.server.ts   → CoinGecko
 *
 * So the walk is transitive now, and the failure names the whole chain — a bare
 * "this file is an offender" is close to useless when the import that matters
 * is three files away from the one you have to edit.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const SRC = 'src';

/** `from '…'` and `import('…')`, capturing the specifier. */
const IMPORT_SPECIFIER = /(?:from|import\()\s*['"]([^'"]+)['"]/g;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

function isClientFile(path: string): boolean {
  return /^\s*['"]use client['"]/m.test(readFileSync(path, 'utf8'));
}

/**
 * Turn a specifier into a file we can keep walking, or null for anything that
 * cannot pull our own server code in (node_modules, css, assets).
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = join(SRC, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null; // package import
  }

  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const resolved = resolveSpecifier(file, match[1]);
    if (resolved) {
      out.push(resolved);
    }
  }
  return out;
}

/**
 * @returns the import chain from `entry` to the first `.server` module it can
 *   reach, or null. Depth-first and memoized per entry: the graph is small, and
 *   naming ONE complete chain per offending page is what makes this fixable.
 */
function chainToServerModule(entry: string): string[] | null {
  const seen = new Set<string>();

  function walk(file: string, trail: string[]): string[] | null {
    if (seen.has(file)) {
      return null;
    }
    seen.add(file);

    for (const next of importsOf(file)) {
      const nextTrail = [...trail, next];
      if (/\.server\.tsx?$/.test(next)) {
        return nextTrail;
      }
      const deeper = walk(next, nextTrail);
      if (deeper) {
        return deeper;
      }
    }
    return null;
  }

  return walk(entry, [entry]);
}

/**
 * How many client entry points can currently reach a `.server` module.
 *
 * 431 when the transitive walk was first switched on, and deliberately left at
 * exactly that: a ratchet, not a target. Demanding zero today would make this
 * red about work nobody has scheduled, which is how a gate teaches people to
 * ignore it. It may fall or hold, never rise.
 *
 * Nothing has been retired yet, and the number is not a to-do list to grind
 * down one file at a time. The chains run through shared helpers —
 * `config/cat-plans` → `services/cat/credit-metering` → `rates.server` accounts
 * for a large share on its own — so cutting one edge retires dozens at once.
 * Splitting those modules is a real refactor and belongs in its own change,
 * not smuggled into the commit that first makes the problem visible.
 *
 * The concrete harm this was hiding is fixed separately and defensively, in
 * rateSource.server.ts: even bundled into a client chunk it now refuses to call
 * out from a browser.
 */
const CLIENT_TO_SERVER_BASELINE = 431;

describe("'use client' modules never reach server-only code", () => {
  it('does not let more client entry points reach a *.server module', () => {
    const offenders = sourceFiles(SRC)
      .filter(isClientFile)
      .map(file => chainToServerModule(file))
      .filter((chain): chain is string[] => chain !== null)
      .map(chain => chain.join('\n    → '));

    if (offenders.length > CLIENT_TO_SERVER_BASELINE) {
      // Print one full chain so the failure is actionable: the import that
      // matters is usually several files from the one you would think to open.
      throw new Error(
        `${offenders.length} client entry points reach a .server module, up from ` +
          `${CLIENT_TO_SERVER_BASELINE}. One chain:\n\n    ${offenders[0]}\n`
      );
    }

    expect(offenders.length).toBeLessThanOrEqual(CLIENT_TO_SERVER_BASELINE);
  });
});
