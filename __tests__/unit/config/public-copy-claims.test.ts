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
import { blocksToText } from '@bitbaum/bip-kit';
import { CONTACT_EMAIL } from '@/config/brand';
import { SETTLEMENT_TRANSPARENCY_CLAIM } from '@/config/landing-page';
import { ENTITY_VISIBILITY_SUMMARY } from '@/config/public-visibility';
import { TIMELINE_VISIBILITY_OPTIONS } from '@/config/timeline';
import { getFaqSections } from '@/lib/faq';

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
    // Round three: the reset email promised "10,000+ Bitcoin innovators" and
    // the audit report a bug bounty "coming soon". Neither was ever true.
    const unmeasured = /\d[\d,]*\+ (?:Bitcoin|users|innovators|members|people)\b|bug bounty/i;
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
        return roleAddress.test(text) || notMit.test(text) || unmeasured.test(text);
      })
      .map(path => relative(ROOT, path));
    expect(offenders).toEqual([]);
  });

  // ROUTES.SUPPORT is the Bitcoin backing page, not a contact form. It was
  // linked as "Talk to the studio" (/partners) and "Questions, or a verified
  // client" (/docs/sign-in-with-orangecat) — a reader with a question landed
  // on a donation page with no way to ask it.
  it('does not send a question to the backing page', () => {
    const askViaSupport =
      /href=\{ROUTES\.SUPPORT\}[^]{0,300}?\b(question|ask|talk|contact|client)/i;
    const offenders = sources
      .filter(({ text }) =>
        text
          .split(/<\/(?:Link|a)>/)
          .some(chunk => askViaSupport.test(chunk.slice(chunk.lastIndexOf('href={'))))
      )
      .map(({ path }) => path);
    expect(offenders).toEqual([]);
  });

  // 2026-11-12, orangecat.ch: /how-it-works and /security said
  // every transaction is publicly verifiable on the Bitcoin blockchain.
  // Lightning, the default rail, settles off-chain. One sentence says what is
  // true for each rail, and those pages show it as is.
  it('promises no public blockchain record for every payment', () => {
    const blanket =
      /(every|all) (OrangeCat )?transactions? (is|are) (publicly verifiable|permanent, transparent)|transparency on the Bitcoin blockchain/i;
    const offenders = sources.filter(({ text }) => blanket.test(text)).map(({ path }) => path);
    expect(offenders).toEqual([]);
    expect(SETTLEMENT_TRANSPARENCY_CLAIM).toMatch(
      /^On-chain .* blockchain; Lightning .* off-chain/
    );
    for (const page of ['how-it-works', 'security']) {
      const path = `src/app/(public)/${page}/page.tsx`;
      expect(sources.find(s => s.path === path)?.text, path).toContain(
        'SETTLEMENT_TRANSPARENCY_CLAIM'
      );
    }
  });

  // Same review: /faq and /docs promised every entity a public /
  // followers-only / private setting. Listings have "Show on Public Profile";
  // that three-way choice belongs to posts and articles. Both pages now show
  // ENTITY_VISIBILITY_SUMMARY.
  it('describes only the visibility settings that exist', () => {
    const invented = /each entity\b[^\n]{0,80}visibility setting/i;
    const faqSource = readFileSync(join(ROOT, 'content/faq.md'), 'utf8');
    const offenders = [...sources, { path: 'content/faq.md', text: faqSource }]
      .filter(({ text }) => invented.test(text))
      .map(({ path }) => path);
    expect(offenders).toEqual([]);

    const answer = getFaqSections()
      .flatMap(section => section.items)
      .find(item => item.question === 'Who can see my activity?');
    expect(answer && blocksToText(answer.blocks)).toContain(ENTITY_VISIBILITY_SUMMARY);
    expect(sources.find(s => s.path === 'src/app/(public)/docs/page.tsx')?.text).toContain(
      '{ENTITY_VISIBILITY_SUMMARY}'
    );

    // The summary stays true: no listing form offers a followers-only choice,
    // and posts offer exactly the three it names.
    const entityForms = files(join(ROOT, 'src/config/entity-configs'))
      .filter(path => /value: 'followers'/.test(readFileSync(path, 'utf8')))
      .map(path => relative(ROOT, path));
    expect(entityForms).toEqual([]);
    expect(TIMELINE_VISIBILITY_OPTIONS.map(option => option.key)).toEqual([
      'public',
      'followers',
      'private',
    ]);
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
