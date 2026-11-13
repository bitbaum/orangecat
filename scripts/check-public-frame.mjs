#!/usr/bin/env node
/**
 * Every public page opens with the one public header.
 *
 * Fleet rule "One shape per kind": siblings share one frame, the same title
 * shape, the same one line under it. Measured on 2026-11-12, the first screens
 * of thirty public pages hand-built their headers: title sizes from 24px to
 * 60px, centred and left, an icon above some titles and a pill above others,
 * some on a raised band. `PublicPageHeader`
 * (src/components/layout/PublicPageHeader.tsx) is the frame; this gate keeps a
 * page from growing its own again.
 *
 * A page file under src/app/(public) fails when it
 *   - writes an <h1> itself, or
 *   - uses PageHeading directly (that is the signed-in title; a public page
 *     gets its title through PublicPageHeader), or
 *   - wraps itself in PageLayout (which adds its own top padding and width).
 *
 * A page that hands its whole screen to a component (a form, a client view)
 * has no <h1> of its own and passes; the component is where to look.
 *
 * EXEMPT lists the pages whose title is not a page header, with the reason.
 * Adding to it is a decision, not a fix.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const PUBLIC_DIR = join(ROOT, 'src/app/(public)');

const EXEMPT = new Map([
  ['articles/page.tsx', 'a list with its Write action beside the title, like a signed-in list'],
  ['articles/[slug]/page.tsx', "an article's own title, set by the writing package"],
  ['blog/[slug]/page.tsx', "a post's own title above its byline"],
  ['pay/page.tsx', 'a payment screen; the money frame owns it'],
  ['pay/[username]/page.tsx', 'a payment screen; the money frame owns it'],
]);

function pageFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      return pageFiles(full);
    }
    return entry.name === 'page.tsx' ? [full] : [];
  });
}

/** Comments may name the things this gate forbids; code may not. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const problems = [];
let framed = 0;

for (const file of pageFiles(PUBLIC_DIR)) {
  const name = relative(PUBLIC_DIR, file).split('\\').join('/');
  if (EXEMPT.has(name)) {
    continue;
  }
  const source = stripComments(readFileSync(file, 'utf8'));
  const where = `src/app/(public)/${name}`;

  if (/<h1[\s>]/.test(source)) {
    problems.push(`${where}: writes its own <h1>. Use <PublicPageHeader title=… lede=… />.`);
  }
  if (/<PageHeading[\s>]/.test(source)) {
    problems.push(
      `${where}: uses PageHeading directly. A public page gets its title through PublicPageHeader.`
    );
  }
  if (/<PageLayout[\s>]/.test(source)) {
    problems.push(
      `${where}: wraps itself in PageLayout. Use PUBLIC_PAGE_WIDTH and PublicPageHeader.`
    );
  }
  if (/<PublicPageHeader[\s>]/.test(source)) {
    framed += 1;
  }
}

if (problems.length > 0) {
  console.error('check:public-frame failed — a public page builds its own header:\n');
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  console.error(
    '\nThe frame is src/components/layout/PublicPageHeader.tsx. If the page is not a page\n' +
      'header at all (a post, a payment screen), add it to EXEMPT in this script with the reason.'
  );
  process.exit(1);
}

console.log(
  `check:public-frame passed — ${framed} public pages open with PublicPageHeader, ${EXEMPT.size} exempt by name.`
);
