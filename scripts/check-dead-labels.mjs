#!/usr/bin/env node
/**
 * A heading that sits BESIDE a chevron-only toggle is a dead click.
 *
 * The shape:
 *
 *   <div className="flex ... justify-between">
 *     <h3>Fund</h3>                  <- looks like the control, isn't
 *     <button onClick={toggle}>      <- the only real target, ~44px wide
 *       <ChevronDown />
 *     </button>
 *   </div>
 *
 * The visitor aims at the word, nothing happens, and the arrow beside it is a
 * small target in a full-width row of apparent affordance. This landed twice
 * in the same sidebar — once on the ContextSwitcher avatar ("should be
 * clickable", reported by two different visitors), once on the Fund /
 * Coordinate / Finance section headers — so the class is closed by a gate
 * instead of a third fix.
 *
 * The correct shape puts the label INSIDE the control, which is what
 * HeaderNavigation already does:
 *
 *   <button onClick={toggle} aria-expanded={open}>
 *     {item.name}
 *     <ChevronDown aria-hidden="true" />
 *   </button>
 *
 * Heuristic, so it is deliberately narrow: a heading, then within 12 lines a
 * <button> containing a Chevron, and no heading inside that button. Anything
 * that trips it is either the bug or a row that should be restructured anyway.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const ROOT = process.cwd();
const LOOKAHEAD = 12;
const HEADING = /<h[1-6]\b/;
const BUTTON = /<button\b/;
const CHEVRON = /<Chevron(Down|Up|Right|Left)\b/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (extname(entry.name) === '.tsx') files.push(full);
  }
  return files;
}

const violations = [];
for (const file of walk(join(ROOT, 'src', 'components'))) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!HEADING.test(line)) return;

    const text = lines.slice(i, i + LOOKAHEAD).join('\n');
    const button = BUTTON.exec(text);
    if (!button || !CHEVRON.test(text)) return;

    // A heading AFTER the <button> means the label is inside the control —
    // the correct shape, not a violation.
    const headingInsideButton = [...text.matchAll(/<h[1-6]\b/g)].some(m => m.index > button.index);
    if (headingInsideButton) return;

    violations.push(`${relative(ROOT, file)}:${i + 1}\n  ${line.trim()}`);
  });
}

if (violations.length > 0) {
  console.error(
    `check:dead-labels — ${violations.length} heading(s) sitting beside a chevron-only toggle.\n` +
      'Put the label inside the button so the whole row is the target:\n'
  );
  violations.forEach(v => console.error(`  ${v}\n`));
  process.exit(1);
}

console.log('check:dead-labels — no headings stranded beside a chevron-only toggle.');
