import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A name exported from `src/config` means one thing.
 *
 * Four names meant two things each, and the type checker could not help,
 * because both spellings were valid imports:
 *
 *   ENTITY_STATUS      4 members in one file, 6 in the other
 *   ModelCapability    a capability NAME in one, a capability RECORD in the other
 *   LOAN_OFFER_TYPES   ['refinance','payoff'] in one, [{value,label}] in the other
 *
 * Autocomplete offers both, the wrong one compiles, and nothing fails until a
 * runtime shape mismatch. A clone detector cannot see this at all — the two
 * declarations share no tokens.
 */

/** Same name in two feature configs, same value, no ambiguity to resolve. */
const ALLOWED: Record<string, string> = {
  OWNER_ACTOR_SLUG:
    'feature-scoped constant in loki-passes and revive-my-old-ride; identical value, neither is a shared vocabulary',
};

const EXPORT = /^export (?:const|function|type|interface|enum) (\w+)/gm;

function configFiles(dir = 'src/config', out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      configFiles(path, out);
    } else if (/\.tsx?$/.test(name)) {
      out.push(path);
    }
  }
  return out;
}

describe('one name, one meaning', () => {
  it('no exported name in src/config is declared in two files', () => {
    const where = new Map<string, string[]>();
    for (const path of configFiles()) {
      for (const m of readFileSync(path, 'utf8').matchAll(EXPORT)) {
        where.set(m[1], [...(where.get(m[1]) ?? []), path]);
      }
    }
    const collisions = [...where.entries()]
      .filter(([name, files]) => files.length > 1 && !(name in ALLOWED))
      .map(([name, files]) => `${name}: ${files.join(', ')}`);
    expect(
      collisions,
      `Rename one, or add it to ALLOWED with the reason both may keep the name:\n${collisions.join('\n')}`
    ).toEqual([]);
  });

  it('keeps the allowance honest — a listed name must still actually collide', () => {
    const where = new Map<string, number>();
    for (const path of configFiles()) {
      for (const m of readFileSync(path, 'utf8').matchAll(EXPORT)) {
        where.set(m[1], (where.get(m[1]) ?? 0) + 1);
      }
    }
    for (const [name, reason] of Object.entries(ALLOWED)) {
      expect(reason.length, `${name} needs a real reason`).toBeGreaterThan(20);
      expect(
        where.get(name) ?? 0,
        `${name} no longer collides — drop it from ALLOWED`
      ).toBeGreaterThan(1);
    }
  });
});
