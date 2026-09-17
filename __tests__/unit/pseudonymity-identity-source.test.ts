/**
 * A pseudonymous account cannot be pseudonymous if the session object is
 * allowed to speak for it.
 *
 * `user.user_metadata` is whatever the OAuth provider handed over at signup.
 * For a Google account that is the person's real name and an
 * lh3.googleusercontent.com avatar URL. The user cannot edit either. `profiles`
 * is what they control. So display identity — name, username, avatar — has
 * exactly one source, and it is the profile.
 *
 * Found live on 2026-09-07: the repost composer read `user_metadata` and fell
 * back to `user.email`. Google had rotated the avatar URL, so the <img> 404'd
 * and rendered its own alt text — the account's REAL NAME, in plain sight, on a
 * profile that had deliberately chosen a pseudonym. Three other components fell
 * back the same way whenever the profile had not loaded yet, and the account
 * dropdown went further: it titlecased the email local-part, so
 * `firstname.lastname@…` was displayed as "Firstname Lastname" — the app
 * reconstructing a legal name nobody had ever typed into it.
 *
 * Every step in those chains was a BETTER guess at the person's real name than
 * the step before, which is exactly backwards. When the profile is missing, the
 * honest answer is a placeholder, not a truer name.
 *
 * Scope: components only. API routes legitimately read user_metadata to SEED a
 * profile at signup — that is where the provider's data is supposed to land.
 * The defect is rendering it.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const COMPONENTS = join(process.cwd(), 'src', 'components');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Strip comments before scanning.
 *
 * The fix for this bug is heavily commented, and those comments necessarily
 * contain the words `user_metadata` and `user.email` in order to explain what
 * was wrong. A scanner that cannot tell code from prose would flag the very
 * commit that fixed the defect — and the natural "fix" for that is to delete
 * the explanation, leaving the next person with no idea why the rule exists.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments, incl. JSX {/* … */}
    .replace(/^[ \t]*\/\/.*$/gm, '') // whole-line // comments
    .replace(/([^:])\/\/.*$/gm, '$1'); // trailing // comments, sparing "https://"
}

describe('display identity comes from the profile, never the auth session', () => {
  const files = walk(COMPONENTS);

  it('scans a non-trivial number of component files', () => {
    // A scanner pointed at an empty directory passes every assertion below it.
    expect(files.length).toBeGreaterThan(50);
  });

  it('no component reads user_metadata', () => {
    const offenders = files.filter(f =>
      stripComments(readFileSync(f, 'utf8')).includes('user_metadata')
    );
    expect(
      offenders.map(f => f.replace(process.cwd() + '/', '')),
      "user_metadata is the OAuth provider's data and the user cannot edit it. " +
        'Read name/username/avatar from the profile instead.'
    ).toEqual([]);
  });

  it('no component derives a display name from an email address', () => {
    // `email.split('@')[0]` and friends. An address is not a chosen name, and
    // for firstname.lastname@ it IS the real name.
    const pattern =
      /(user\??\.)?email[^\n]{0,40}\.split\(\s*['"]@['"]\s*\)|email\.indexOf\(\s*['"]@['"]\s*\)/;
    const offenders = files.filter(f => pattern.test(stripComments(readFileSync(f, 'utf8'))));
    expect(
      offenders.map(f => f.replace(process.cwd() + '/', '')),
      'An email local-part is not a display name — it is frequently the real name.'
    ).toEqual([]);
  });

  it('the scanner itself can still fail', () => {
    // Mutation check. Both predicates above pass trivially if stripComments
    // eats everything, or if the patterns stopped matching. Prove on a fixture
    // that they still fire, so a green suite means "clean", not "inert".
    const bad = `const n = user?.user_metadata?.name || user.email.split('@')[0];`;
    expect(stripComments(bad)).toContain('user_metadata');
    expect(/(user\??\.)?email[^\n]{0,40}\.split\(\s*['"]@['"]\s*\)/.test(stripComments(bad))).toBe(
      true
    );

    // And prove the comment-stripping works, or the rule would be unfixable:
    // the commit that fixes this bug must be able to explain itself.
    const commented = `// user_metadata was read here and email.split('@')[0] used\nconst n = profile?.name;`;
    expect(stripComments(commented)).not.toContain('user_metadata');
  });
});
