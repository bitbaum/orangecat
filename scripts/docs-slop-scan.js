#!/usr/bin/env node
/*
  docs-slop-scan.js
  Scans production code (src/, app/) for sloppy placeholder phrases.

  Why src/ + app/ only: docs/ legitimately contains "TODO" (in
  archived roadmap status markers, TASK_QUEUE.md, etc.) and
  "TBD" (sprint planning), which are intentional authoring, not slop.
  This script's job is to catch slop that would ship to a USER —
  lorem-ipsum copy, lazy "TBD" labels, half-written feature stubs.

  Why these specific phrases (and not others):
  - "lorem ipsum"      — never legitimately shipped
  - "tbd" / "todo" / "wip" / "work in progress" — productionised
                         laziness when in src code
  - "beta only"        — usually a planning artifact, shouldn't ship

  Phrases deliberately NOT scanned:
  - "placeholder"      — matches React `placeholder` attrs, type
                         fields, and Tailwind `placeholder:` variant
                         classes everywhere. Way too coarse.
  - "coming soon"      — OrangeCat literally has a /coming-soon page
                         and a COMING_SOON config constant. The phrase
                         is a feature name in this codebase, not slop.
*/

const { glob } = require('glob');
const fs = require('fs');

const PHRASES = [
  /tbd/i,
  /\btodo\b/i,
  /\bwip\b/i,
  /work in progress/i,
  /lorem ipsum/i,
  /beta only/i,
];

async function main() {
  const patterns = ['src/**/*.{ts,tsx,md}', 'app/**/*.{ts,tsx,md}'];

  const files = (
    await Promise.all(
      patterns.map(p =>
        glob(p, { ignore: ['**/node_modules/**', '**/.next/**', '**/__tests__/**', '.claude/**'] })
      )
    )
  ).flat();

  let violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      PHRASES.forEach(rx => {
        if (rx.test(line)) {
          violations.push({ file, line: idx + 1, text: line.trim() });
        }
      });
    });
  }

  if (violations.length) {
    console.log('Slop phrases found:');
    violations.slice(0, 100).forEach(v => console.log(`- ${v.file}:${v.line} ${v.text}`));
    process.exitCode = 1;
  } else {
    console.log('No slop phrases found.');
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
