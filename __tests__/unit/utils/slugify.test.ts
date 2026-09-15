import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from '@/utils/string';
import { slugifyTitle } from '@/config/articles';

/**
 * One slug rule, and it must not eat accented letters.
 *
 * `slugify` deleted anything outside [a-z0-9], so on a platform whose users
 * are mostly Swiss it produced "zrich", "caf-genve", "bckerei-mller". Three
 * other copies existed; two of them normalised first and got it right, so the
 * answer depended on which function you happened to import.
 *
 * It also cost a real person their handle: a Cyrillic name emptied the slug
 * completely and the page shipped as /profiles/someone (2026-09-11). The fix
 * then was a transliteration table beside the caller, not here.
 */
describe('slugify keeps the letter, drops the accent', () => {
  it.each([
    ['Zürich', 'zurich'],
    ['Café Genève', 'cafe-geneve'],
    ['Bäckerei Müller', 'backerei-muller'],
    ['Neuchâtel', 'neuchatel'],
    ['Œuvre', 'uvre'], // no NFKD decomposition; still better than empty
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('never returns a slug with a leading or trailing dash', () => {
    for (const input of ['  Zürich  ', '—Zürich—', 'Zürich!!!']) {
      const out = slugify(input);
      expect(out.startsWith('-')).toBe(false);
      expect(out.endsWith('-')).toBe(false);
    }
  });

  it('truncates before appending a random suffix, so maxLength bounds the base', () => {
    const out = slugify('a'.repeat(100), { maxLength: 10, randomSuffix: true });
    const [base, suffix] = [out.slice(0, 10), out.slice(11)];
    expect(base).toBe('a'.repeat(10));
    expect(suffix).toHaveLength(5);
  });

  it('still yields nothing for a script it cannot decompose — callers transliterate first', () => {
    // Pinned deliberately: this is WHY domain/profileClaims/slug.ts exists.
    expect(slugify('Марина')).toBe('');
  });
});

describe('the other slug helpers delegate rather than re-derive', () => {
  it('article titles agree with slugify', () => {
    expect(slugifyTitle('Zürich im Winter')).toBe(slugify('Zürich im Winter', { maxLength: 80 }));
  });

  it('an article title that slugs to nothing still gets a usable slug', () => {
    expect(slugifyTitle('Марина')).toBe('article');
  });

  it('no file re-implements the strip-and-dash chain', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) {
          walk(p);
        } else if (/\.tsx?$/.test(name)) {
          files.push(p);
        }
      }
    };
    walk('src');
    // The tell is the character-class replace that turns everything else into
    // a dash. Only the SSOT may contain it.
    const rivals = files.filter(
      f =>
        f !== 'src/utils/string.ts' &&
        /replace\(\/\[\^a-z0-9[^)]*\]\+?\/g, '-'\)/.test(readFileSync(f, 'utf8'))
    );
    expect(rivals, `Call slugify() from @/utils/string instead:\n${rivals.join('\n')}`).toEqual([]);
  });
});
