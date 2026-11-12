/**
 * Public handles must not be minted from email addresses.
 *
 * `/profiles/<username>` is served with no auth and robots.txt has no
 * `/profiles` rule. Every profile-creation path used to set the handle to
 * `email.split('@')[0]`, which published 77 people's email local parts as
 * crawlable identifiers — reported through OrangeCat's own feedback widget.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { neutralUsernameFor } from '@/lib/profile/neutral-username';
import { isValidUsername } from '@/lib/validation/base';

describe('neutralUsernameFor', () => {
  const id = '3f2a1b9c-7d4e-4a52-9c8b-0e1f2a3b4c5d';

  it('carries nothing about the person', () => {
    expect(neutralUsernameFor(id)).toBe('user_3f2a1b9c7d4e');
  });

  it('is accepted by the app own username rules', () => {
    expect(isValidUsername(neutralUsernameFor(id))).toBe(true);
  });

  it('mirrors the SQL trigger: user_ + 12 hex of the id, dashes stripped', () => {
    // supabase/migrations/20260826130000: 'user_' || left(replace(id::text,'-',''), 12)
    expect(neutralUsernameFor(id)).toBe(`user_${id.replace(/-/g, '').slice(0, 12)}`);
  });

  it('differs per user', () => {
    expect(neutralUsernameFor(id)).not.toBe(
      neutralUsernameFor('99999999-7d4e-4a52-9c8b-0e1f2a3b4c5d')
    );
  });
});

/**
 * The class, closed. Fixing the DB trigger alone was NOT enough — `ensureProfile`
 * and two form pre-fills each derived the handle from the email independently,
 * and the count rose 72 -> 77 while the trigger fix was being written. A comment
 * would not have caught that; this does.
 */
describe('no code derives a public handle from an email', () => {
  const SRC = join(process.cwd(), 'src');
  const ALLOWED = join('lib', 'profile', 'neutral-username.ts'); // documents the bug in prose

  function sourceFiles(dir: string, out: string[] = []): string[] {
    // The directory entry already says what it is; a stat per file doubled
    // the syscalls on a slow filesystem.
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) sourceFiles(full, out);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  it('has no site assigning a username from an email local part', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      if (file.endsWith(ALLOWED)) continue;
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
          // Same line mentions a handle AND splits an address on '@'.
          if (/username/i.test(line) && /split\(\s*['"]@['"]\s*\)/.test(line)) {
            offenders.push(`${file}:${i + 1}: ${trimmed}`);
          }
        });
    }
    expect(offenders).toEqual([]);
    // Reads every file under src/ once — a full-tree read cannot get cheaper
    // than that, and under the whole suite's parallel I/O it outran 30s.
  }, 120_000);
});
