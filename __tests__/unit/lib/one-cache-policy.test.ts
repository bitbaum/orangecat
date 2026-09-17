import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_PRESETS } from '@/lib/api/cache-policy';
import { getCacheControl } from '@/lib/api/helpers';

/**
 * One vocabulary for "how long may this be reused".
 *
 * The seconds were written out by hand in three places. `CACHE_PRESETS.MEDIUM`
 * appeared verbatim in two routes, and the short policy existed in two
 * spellings that differed by a `public,` prefix — the same policy saying two
 * different things to a shared cache, with nothing to keep them in step.
 *
 * jscpd cannot see any of this: a quoted header value is a handful of tokens.
 */

const OWNER = 'src/lib/api/cache-policy.ts';

/** Any quoted string — narrowed to cache directives at the point of use. */
const QUOTED = /['"`][^'"`\n]*['"`]/g;

/**
 * Responses that are cached for the BROWSER rather than a CDN — `max-age`
 * without `stale-while-revalidate`. Different job, different vocabulary; the
 * OG image and feed routes set their own and should not name a CDN preset.
 */
const BROWSER_CACHE = /max-age=\d+/;

function sourceFiles(dir = 'src', out: string[] = []): string[] {
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

describe('one cache policy', () => {
  it('composes the helper from the presets rather than repeating them', () => {
    expect(getCacheControl(false)).toBe(`public, ${CACHE_PRESETS.SHORT}`);
    expect(getCacheControl(true)).toBe(`private, no-cache, ${CACHE_PRESETS.NONE}`);
  });

  it('still returns exactly what it always returned', () => {
    // Pinned as literals on purpose: composing them from the same constants the
    // implementation uses would assert nothing.
    expect(getCacheControl(false)).toBe('public, s-maxage=60, stale-while-revalidate=300');
    expect(getCacheControl(true)).toBe('private, no-cache, no-store, must-revalidate');
  });

  it('no file retypes a policy the presets already name', () => {
    const preset = new Map(Object.entries(CACHE_PRESETS).map(([k, v]) => [v as string, k]));
    const offenders: string[] = [];
    for (const path of sourceFiles()) {
      if (path === OWNER) {
        continue;
      }
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((raw, i) => {
          const line = raw.trim();
          if (line.startsWith('*') || line.startsWith('//')) {
            return;
          }
          for (const m of line.matchAll(QUOTED)) {
            const value = m[0].slice(1, -1);
            const named = preset.get(value) ?? preset.get(value.replace(/^public, /, ''));
            if (named) {
              offenders.push(`${path}:${i + 1}  is CACHE_PRESETS.${named} spelled out`);
            }
          }
        });
    }
    expect(
      offenders,
      `Name the preset instead of retyping it:\n${offenders.join('\n')}`
    ).toEqual([]);
  });

  it('no CDN policy is spelled out in two different files', () => {
    const seen = new Map<string, string[]>();
    for (const path of sourceFiles()) {
      if (path === OWNER) {
        continue;
      }
      for (const m of readFileSync(path, 'utf8').matchAll(QUOTED)) {
        const value = m[0].slice(1, -1);
        if (!/s-maxage=\d+/.test(value) || BROWSER_CACHE.test(value)) {
          continue;
        }
        const where = seen.get(value) ?? [];
        if (!where.includes(path)) {
          seen.set(value, [...where, path]);
        }
      }
    }
    const shared = [...seen.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([value, files]) => `"${value}" in ${files.join(', ')}`);
    expect(
      shared,
      `One policy, two homes — add it to CACHE_PRESETS:\n${shared.join('\n')}`
    ).toEqual([]);
  });
});
