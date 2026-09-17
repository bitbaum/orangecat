import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Two minds, one seam.
 *
 * Cat is the platform's mind: it knows everyone and everything on OrangeCat
 * and feeds an economic profile that is partly public. A companion knows
 * only its own soul and the person it talks to. If companion code ever
 * imported Cat's memory, economic profile, offers, interests or discovery —
 * directly or three files away — a confidence shared with a companion could
 * surface on a public profile. This test walks every import transitively
 * from the companion entry points and fails on the first crossing.
 *
 * The Cat Credits ledger (services/cat/credits) is money plumbing shared by
 * the whole platform and is deliberately NOT on the list.
 */

const ROOTS = [
  'src/services/companions',
  'src/app/api/ai-assistants',
  'src/services/ai/sendMessage.ts',
  'src/services/ai/sendMessage-internals.ts',
];

const FORBIDDEN =
  /services\/cat\/(memory|economic-profile|offer-engine|interests|discovery|nudges|chat-orchestrator|chat-prepare|action-|tool-|exec-actions|prompt-suggestions|handlers\/)/;

const IMPORT_SPECIFIER = /(?:from|import\()\s*['"]([^'"]+)['"]/g;

function sourceFiles(path: string, out: string[] = []): string[] {
  if (!existsSync(path)) {
    return out;
  }
  if (statSync(path).isFile()) {
    out.push(path);
    return out;
  }
  for (const name of readdirSync(path)) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) {
      sourceFiles(child, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(child);
    }
  }
  return out;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = join('src', specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
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

function walk(entry: string, seen: Map<string, string[]>, chain: string[]): void {
  if (seen.has(entry)) {
    return;
  }
  seen.set(entry, chain);
  const source = readFileSync(entry, 'utf8');
  for (const match of source.matchAll(IMPORT_SPECIFIER)) {
    const target = resolveSpecifier(entry, match[1]);
    if (target) {
      walk(target, seen, [...chain, target]);
    }
  }
}

describe('companion code never crosses into Cat', () => {
  it('imports nothing from the economic pipeline, transitively', () => {
    const seen = new Map<string, string[]>();
    for (const root of ROOTS) {
      for (const file of sourceFiles(root)) {
        walk(file, seen, [file]);
      }
    }
    const crossings = [...seen.entries()]
      .filter(([file]) => FORBIDDEN.test(file))
      .map(([, chain]) => chain.join('\n    → '));
    expect(crossings, `Companion code reaches Cat:\n  ${crossings.join('\n  ')}`).toEqual([]);
    expect(seen.size).toBeGreaterThan(5);
  });
});
