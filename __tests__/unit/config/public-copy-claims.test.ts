/**
 * Public copy may not carry a fact that already has one home.
 *
 * 2026-10-02: the FAQ, /status, /security, the OpenAPI spec and both legal
 * texts published hello@, support@, security@ and integrations@orangecat.ch.
 * None of them is a mailbox — cato@ is the only one on the domain — so a
 * vulnerability report or a privacy request bounced. The same sweep found
 * /technology still saying "Next.js 15" after /docs had been derived from
 * package.json (stack-versions.test.ts guarded the helper, not the page that
 * never used it).
 *
 * So: a public surface names an address only through CONTACT_EMAIL, and a
 * framework version only through STACK.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CONTACT_EMAIL } from '@/config/brand';

const ROOT = join(__dirname, '../../..');
const SCANNED = ['src/app/(public)', 'src/components/layout', 'src/config', 'src/lib/openapi'];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return files(path);
    }
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const sources = SCANNED.flatMap(dir => files(join(ROOT, dir))).map(path => ({
  path: relative(ROOT, path),
  text: readFileSync(path, 'utf8'),
}));

describe('public copy', () => {
  it('scans real files', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('names no orangecat.ch mailbox except through CONTACT_EMAIL', () => {
    // Lightning-address examples (yourname@, name@, …) are pay links, not
    // mailboxes, so only a mailto: or a role address counts.
    const roleAddress =
      /\b(hello|support|security|integrations|info|contact|privacy|legal|press|mao)@orangecat\.ch\b/;
    const literalMailto = /mailto:[a-z0-9._-]+@/i;
    const offenders = sources
      .filter(({ text }) => roleAddress.test(text) || literalMailto.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
    expect(CONTACT_EMAIL).toBe('cato@orangecat.ch');
  });

  // The round after: the same dead addresses and a "proprietary" licence
  // survived one directory away — the SDK README, the password-recovery email,
  // the security docs. Prose that leaves the app (markdown, email templates,
  // package metadata) is scanned here as text.
  it('outside the app, names no dead address and claims no licence but MIT', () => {
    const roleAddress =
      /\b(hello|support|security|integrations|info|contact|privacy|legal|press|mao)@orangecat\.(ch|com|org)\b/;
    const notMit = /\bUNLICENSED\b|\(proprietary\)/;
    const prose = (dir: string): string[] =>
      readdirSync(dir).flatMap(name => {
        const path = join(dir, name);
        if (name === 'node_modules' || name === 'dist') {
          return [];
        }
        if (statSync(path).isDirectory()) {
          return prose(path);
        }
        return /\.(md|html|json)$/.test(name) ? [path] : [];
      });
    const scanned = [
      ...['packages', 'supabase/templates', 'legal', 'content', 'docs/security'].flatMap(dir =>
        prose(join(ROOT, dir))
      ),
      join(ROOT, 'README.md'),
      join(ROOT, 'SECURITY.md'),
      join(ROOT, 'package.json'),
    ];
    expect(scanned.length).toBeGreaterThan(10);
    const offenders = scanned
      .filter(path => {
        const text = readFileSync(path, 'utf8');
        return roleAddress.test(text) || notMit.test(text);
      })
      .map(path => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });

  it('types no framework version by hand', () => {
    const handTyped = /(Next\.js|TypeScript|Tailwind CSS|React) \d+/;
    const offenders = sources
      .filter(({ path }) => !path.endsWith('stack-versions.ts'))
      .filter(({ text }) => handTyped.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });
});
