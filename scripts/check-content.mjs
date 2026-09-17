#!/usr/bin/env node
// Parses every content/**/*.md with the SAME pipeline the site renders with
// (bip-kit typed blocks). A malformed chart/stats fence THROWS at parse time
// by design — this gate fails the PR instead of the standalone build on main
// (the successor to check-mdx.mjs, which guarded the retired MDX compiler
// after the 2026-08-13 red-main incident). Also refuses stray .mdx files:
// the MDX pipeline is gone, and an .mdx file would silently never render.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter, parseContentBlocks } from 'bip-kit';

function contentFiles(dir, ext) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      return contentFiles(p, ext);
    }
    return name.endsWith(ext) ? [p] : [];
  });
}

const stray = contentFiles('content', '.mdx');
if (stray.length > 0) {
  console.error(`✗ .mdx files found — the MDX pipeline is retired; convert to .md:`);
  for (const f of stray) {
    console.error(`  ${f}`);
  }
  process.exit(1);
}

const files = contentFiles('content', '.md');
let failed = 0;
for (const file of files) {
  try {
    const { meta, body } = parseFrontmatter(readFileSync(file, 'utf8'));
    if (!meta.title) {
      throw new Error('missing title frontmatter');
    }
    const blocks = parseContentBlocks(body);
    if (blocks.length === 0) {
      throw new Error('body parsed to zero blocks');
    }
  } catch (e) {
    failed++;
    console.error(`✗ ${file}: ${e.message}`);
  }
}
if (failed) {
  console.error(`${failed}/${files.length} content file(s) fail to parse`);
  process.exit(1);
}
console.log(`✓ ${files.length} content files parse clean through bip-kit`);
